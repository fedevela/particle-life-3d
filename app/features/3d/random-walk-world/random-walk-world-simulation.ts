import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  createNeighborSpatialIndex,
  deriveFrameUpdatePlan,
} from "~/features/3d/random-walk-world/peer-influence/runtime";
import { buildRandomWalkContractText } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-contract";
import { integrateDotStep } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-dot-step";
import { hashIndexNoise } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-impulse";
import {
  assessFrameProgression,
  normalizeAmbientFriction,
  shouldApplyRealtimePhysicsParams,
} from "~/features/3d/random-walk-world/simulation/random-walk-parameter-runtime";
import { hashSeed, nextRandomFromState } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-rng";
import {
  DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS,
  type RandomWalkWorldPhysicsParams,
  type RandomWalkWorldParams,
} from "~/types/random-walk-world";

const RANDOM_WALK_FRAME_DURATION_MS = 1000 / 60;
const MAX_CAPTURED_CONTRACT_FRAMES = 2048;

export function getRandomWalkFrameForTimeMs(timeMs: number) {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return 0;
  }

  return Math.round(timeMs / RANDOM_WALK_FRAME_DURATION_MS);
}

export class RandomWalkWorldSimulation {
  private readonly params: RandomWalkWorldParams;
  private physicsParams: RandomWalkWorldPhysicsParams;
  private readonly seed: string;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly massNoiseByDot: Float32Array;
  private readonly captureContractFrames: boolean;
  private readonly contractsByFrame = new Map<number, string>();
  private readonly physicsPort = createRandomWalkToroidalPhysicsPort();
  private rngState: number;
  private physicsParamsVersion = 0;
  private lastAppliedPhysicsParamsVersion = -1;
  private frame = 0;

  constructor(
    params: RandomWalkWorldParams,
    seed: string,
    captureContractFrames = false,
    physicsParams: RandomWalkWorldPhysicsParams = DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS,
  ) {
    this.params = params;
    this.physicsParams = physicsParams;
    this.seed = seed;
    this.captureContractFrames = captureContractFrames;
    this.positions = new Float32Array(params.dotCount * 3);
    this.velocities = new Float32Array(params.dotCount * 3);
    this.massNoiseByDot = new Float32Array(params.dotCount);
    this.rngState = hashSeed(seed);
    this.initializeMassNoise();
    this.initializeState();
    this.captureFrameContract(0);
  }

  public reset() {
    this.frame = 0;
    this.rngState = hashSeed(this.seed);
    this.initializeState();
    this.contractsByFrame.clear();
    this.captureFrameContract(0);
  }

  public stepFrame() {
    if (
      shouldApplyRealtimePhysicsParams({
        latestUiPhysicsParamsVersion: this.physicsParamsVersion,
        lastAppliedPhysicsParamsVersion: this.lastAppliedPhysicsParamsVersion,
      })
    ) {
      this.lastAppliedPhysicsParamsVersion = this.physicsParamsVersion;
    }

    const normalizedFriction = normalizeAmbientFriction(this.physicsParams.ambientFriction);
    const framePlan = deriveFrameUpdatePlan({
      mode: this.physicsParams.mode,
      frictionFactor: normalizedFriction,
      peerRadius: this.physicsParams.peerInfluenceRadius,
      velocityBiasWeight: this.physicsParams.velocityBiasWeight,
      peerBiasWeight: this.physicsParams.peerBiasWeight,
    });

    const maxSpeed = this.params.stepScale * this.physicsParams.maxSpeedMultiplier;
    let previousSpeedTotal = 0;
    let nextSpeedTotal = 0;
    let wrapOccurred = false;
    const neighborSpatialIndex =
      framePlan.mode === "peer-influenced-random-walk"
        ? createNeighborSpatialIndex(
            this.positions,
            this.velocities,
            this.params.dotCount,
            this.physicsParams.peerInfluenceRadius,
          )
        : null;
    const separationSpatialIndex =
      framePlan.mode === "peer-influenced-random-walk"
        ? createNeighborSpatialIndex(
            this.positions,
            this.velocities,
            this.params.dotCount,
            this.physicsParams.separationRadius,
          )
        : null;

    for (let index = 0; index < this.params.dotCount; index += 1) {
      const dotStep = integrateDotStep({
        dotIndex: index,
        params: this.params,
        physicsParams: this.physicsParams,
        mode: framePlan.mode,
        normalizedFriction,
        maxSpeed,
        positions: this.positions,
        velocities: this.velocities,
        massNoiseByDot: this.massNoiseByDot,
        neighborSpatialIndex,
        separationSpatialIndex,
        physicsPort: this.physicsPort,
        nextSignedRandom: () => this.nextSignedRandom(),
      });
      previousSpeedTotal += dotStep.previousSpeed;
      nextSpeedTotal += dotStep.nextSpeed;
      wrapOccurred = wrapOccurred || dotStep.wrapOccurred;
    }

    assessFrameProgression({
      frameDurationMs: RANDOM_WALK_FRAME_DURATION_MS,
      previousAverageSpeed: previousSpeedTotal / this.params.dotCount,
      nextAverageSpeed: nextSpeedTotal / this.params.dotCount,
      wrapOccurred,
    });

    this.frame += 1;
    this.captureFrameContract(this.frame);
  }

  public setPhysicsParams(nextPhysicsParams: RandomWalkWorldPhysicsParams) {
    this.physicsParams = nextPhysicsParams;
    this.physicsParamsVersion += 1;
    this.contractsByFrame.clear();
    this.captureFrameContract(this.frame);
  }

  public stepToFrame(targetFrame: number) {
    const safeTargetFrame = Math.max(0, Math.floor(targetFrame));
    while (this.frame < safeTargetFrame) {
      this.stepFrame();
    }
  }

  public getFrame() {
    return this.frame;
  }

  public getPositions() {
    return this.positions;
  }

  public getContractTextAtFrame(targetFrame: number) {
    this.stepToFrame(targetFrame);

    if (this.captureContractFrames) {
      const cached = this.contractsByFrame.get(targetFrame);
      if (cached) {
        return cached;
      }
    }

    return this.buildContractText();
  }

  public getContractTextAtTimeMs(timeMs: number) {
    const targetFrame = getRandomWalkFrameForTimeMs(timeMs);
    return this.getContractTextAtFrame(targetFrame);
  }

  private initializeState() {
    const spawnExtent = this.params.boundaryExtent * 0.8;
    for (let index = 0; index < this.params.dotCount; index += 1) {
      const offset = index * 3;
      this.positions[offset] = this.nextSignedRandom() * spawnExtent;
      this.positions[offset + 1] = this.nextSignedRandom() * spawnExtent;
      this.positions[offset + 2] = this.nextSignedRandom() * spawnExtent;

      this.velocities[offset] = this.nextSignedRandom() * this.params.stepScale;
      this.velocities[offset + 1] = this.nextSignedRandom() * this.params.stepScale;
      this.velocities[offset + 2] = this.nextSignedRandom() * this.params.stepScale;
    }
  }

  private initializeMassNoise() {
    for (let index = 0; index < this.params.dotCount; index += 1) {
      this.massNoiseByDot[index] = hashIndexNoise(this.seed, index);
    }
  }

  private nextRandom() {
    const { nextState, value } = nextRandomFromState(this.rngState);
    this.rngState = nextState;
    return value;
  }

  private nextSignedRandom() {
    return this.nextRandom() * 2 - 1;
  }

  private captureFrameContract(frame: number) {
    if (!this.captureContractFrames) {
      return;
    }

    this.contractsByFrame.set(frame, this.buildContractText());
    const trimBeforeFrame = frame - MAX_CAPTURED_CONTRACT_FRAMES;
    if (trimBeforeFrame >= 0) {
      this.contractsByFrame.delete(trimBeforeFrame);
    }
  }

  private buildContractText() {
    return buildRandomWalkContractText({
      frame: this.frame,
      mode: this.physicsParams.mode,
      boundaryMode: this.physicsParams.boundaryMode,
      dotCount: this.params.dotCount,
      stepScale: this.params.stepScale,
      boundaryExtent: this.params.boundaryExtent,
      ambientFriction: this.physicsParams.ambientFriction,
      peerInfluenceRadius: this.physicsParams.peerInfluenceRadius,
      randomImpulseWeight: this.physicsParams.randomImpulseWeight,
      separationWeight: this.physicsParams.separationWeight,
      separationRadius: this.physicsParams.separationRadius,
      maxSpeedMultiplier: this.physicsParams.maxSpeedMultiplier,
      velocityDampingCurve: this.physicsParams.velocityDampingCurve,
      neighborCountCap: this.physicsParams.neighborCountCap,
      centerAttraction: this.physicsParams.centerAttraction,
      massVariance: this.physicsParams.massVariance,
      velocityBiasWeight: this.physicsParams.velocityBiasWeight,
      peerBiasWeight: this.physicsParams.peerBiasWeight,
      neighborCohesionWeight: this.physicsParams.neighborCohesionWeight,
      peerImpulseScale: this.physicsParams.peerImpulseScale,
      positions: this.positions,
      velocities: this.velocities,
    });
  }
}
