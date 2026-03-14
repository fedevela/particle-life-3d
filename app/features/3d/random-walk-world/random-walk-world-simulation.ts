import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  createNeighborSpatialIndex,
  deriveAmbientFrictionDecayPlan,
  deriveDualBiasImpulseDirectionPlan,
  deriveFrameUpdatePlan,
  deriveNeighborCohesionDirectionFromSpatialIndex,
  deriveNeighborAverageDirectionFromSpatialIndex,
  deriveNeighborSeparationDirectionFromSpatialIndex,
} from "~/features/3d/random-walk-world/peer-influence/runtime";
import { buildRandomWalkContractText } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-contract";
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
const REGULAR_IMPULSE_SCALE_FACTOR = 0.15;
const MASS_VARIANCE_MAX = 0.95;

function normalizeDirection(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

function hashIndexNoise(seed: string, dotIndex: number) {
  let hash = hashSeed(seed) ^ Math.imul(dotIndex + 1, 2654435761);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
}

function deriveMassFactorFromNoise(massNoise: number, massVariance: number) {
  const normalizedVariance = Math.min(MASS_VARIANCE_MAX, Math.max(0, massVariance));
  if (normalizedVariance <= 0) {
    return 1;
  }

  const centeredNoise = massNoise * 2 - 1;
  return Math.max(0.05, 1 + centeredNoise * normalizedVariance);
}

export function getRandomWalkFrameForTimeMs(timeMs: number) {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return 0;
  }

  return Math.round(timeMs / RANDOM_WALK_FRAME_DURATION_MS);
}

type BoundaryTransitionInput = {
  nextPosition: readonly [number, number, number];
  velocity: readonly [number, number, number];
  boundaryExtent: number;
  boundaryMode: RandomWalkWorldPhysicsParams["boundaryMode"];
  physicsPort: ReturnType<typeof createRandomWalkToroidalPhysicsPort>;
};

function applyBoundaryTransition(input: BoundaryTransitionInput) {
  const boundary = {
    min: [-input.boundaryExtent, -input.boundaryExtent, -input.boundaryExtent] as const,
    max: [input.boundaryExtent, input.boundaryExtent, input.boundaryExtent] as const,
  };

  if (input.boundaryMode === "wrap-around") {
    return input.physicsPort.deriveToroidalWrapTransition(
      {
        position: input.nextPosition,
        velocity: input.velocity,
      },
      boundary,
    );
  }

  let x = input.nextPosition[0];
  let y = input.nextPosition[1];
  let z = input.nextPosition[2];
  let vx = input.velocity[0];
  let vy = input.velocity[1];
  let vz = input.velocity[2];
  let wrapOccurred = false;

  const min = -input.boundaryExtent;
  const max = input.boundaryExtent;
  const axes = [
    { position: x, velocity: vx },
    { position: y, velocity: vy },
    { position: z, velocity: vz },
  ];

  for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 1) {
    const axis = axes[axisIndex];
    if (axis.position < min || axis.position > max) {
      wrapOccurred = true;

      if (input.boundaryMode === "bounce-back") {
        if (axis.position < min) {
          axis.position = min + (min - axis.position);
        } else {
          axis.position = max - (axis.position - max);
        }
        axis.position = Math.min(max, Math.max(min, axis.position));
        axis.velocity *= -1;
      } else {
        axis.position = Math.min(max, Math.max(min, axis.position));
        axis.velocity = 0;
      }
    }
  }

  x = axes[0].position;
  y = axes[1].position;
  z = axes[2].position;
  vx = axes[0].velocity;
  vy = axes[1].velocity;
  vz = axes[2].velocity;

  return {
    wrapOccurred,
    nextPosition: [x, y, z] as const,
    preservedVelocity: [vx, vy, vz] as const,
  };
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
      const offset = index * 3;
      let vx = this.velocities[offset];
      let vy = this.velocities[offset + 1];
      let vz = this.velocities[offset + 2];
      previousSpeedTotal += Math.hypot(vx, vy, vz);

      if (framePlan.mode === "regular-random-walk") {
        vx += this.nextSignedRandom() * this.params.stepScale * REGULAR_IMPULSE_SCALE_FACTOR;
        vy += this.nextSignedRandom() * this.params.stepScale * REGULAR_IMPULSE_SCALE_FACTOR;
        vz += this.nextSignedRandom() * this.params.stepScale * REGULAR_IMPULSE_SCALE_FACTOR;
      } else {
        const friction = deriveAmbientFrictionDecayPlan({
          velocity: [vx, vy, vz],
          frictionFactor: normalizedFriction,
          dampingCurve: this.physicsParams.velocityDampingCurve,
        });
        vx = friction.decayedVelocity[0];
        vy = friction.decayedVelocity[1];
        vz = friction.decayedVelocity[2];

        const velocityDirection = normalizeDirection(vx, vy, vz);
        const neighborAggregate = deriveNeighborAverageDirectionFromSpatialIndex(
          index,
          neighborSpatialIndex,
          this.physicsParams.neighborCountCap,
        );
        const neighborCohesionDirection = deriveNeighborCohesionDirectionFromSpatialIndex(
          index,
          neighborSpatialIndex,
          this.physicsParams.neighborCountCap,
        );
        const neighborSeparationDirection = deriveNeighborSeparationDirectionFromSpatialIndex(
          index,
          separationSpatialIndex,
          this.physicsParams.neighborCountCap,
        );
        const centerAttractionDirection = normalizeDirection(
          -this.positions[offset],
          -this.positions[offset + 1],
          -this.positions[offset + 2],
        );
        const randomDirection = normalizeDirection(
          this.nextSignedRandom(),
          this.nextSignedRandom(),
          this.nextSignedRandom(),
        );
        const impulseDirection = deriveDualBiasImpulseDirectionPlan({
          randomUnitDirection: randomDirection,
          currentVelocityDirection: velocityDirection,
          peerAverageDirection: neighborAggregate.averageDirection,
          peerCohesionDirection: neighborCohesionDirection,
          peerSeparationDirection: neighborSeparationDirection,
          centerAttractionDirection,
          randomImpulseWeight: this.physicsParams.randomImpulseWeight,
          velocityBiasWeight: this.physicsParams.velocityBiasWeight,
          peerBiasWeight: this.physicsParams.peerBiasWeight,
          peerCohesionWeight: this.physicsParams.neighborCohesionWeight,
          peerSeparationWeight: this.physicsParams.separationWeight,
          centerAttractionWeight: this.physicsParams.centerAttraction,
        });
        const massFactor = deriveMassFactorFromNoise(
          this.massNoiseByDot[index],
          this.physicsParams.massVariance,
        );
        const impulseScale = (this.params.stepScale * this.physicsParams.peerImpulseScale) / massFactor;
        vx += impulseDirection.biasedDirection[0] * impulseScale;
        vy += impulseDirection.biasedDirection[1] * impulseScale;
        vz += impulseDirection.biasedDirection[2] * impulseScale;
      }

      const speed = Math.hypot(vx, vy, vz);
      if (speed > maxSpeed && speed > 0) {
        const ratio = maxSpeed / speed;
        vx *= ratio;
        vy *= ratio;
        vz *= ratio;
      }

      const transition = applyBoundaryTransition({
        nextPosition: [
          this.positions[offset] + vx,
          this.positions[offset + 1] + vy,
          this.positions[offset + 2] + vz,
        ],
        velocity: [vx, vy, vz],
        boundaryExtent: this.params.boundaryExtent,
        boundaryMode: this.physicsParams.boundaryMode,
        physicsPort: this.physicsPort,
      });
      wrapOccurred = wrapOccurred || transition.wrapOccurred;

      this.positions[offset] = transition.nextPosition[0];
      this.positions[offset + 1] = transition.nextPosition[1];
      this.positions[offset + 2] = transition.nextPosition[2];
      this.velocities[offset] = transition.preservedVelocity[0];
      this.velocities[offset + 1] = transition.preservedVelocity[1];
      this.velocities[offset + 2] = transition.preservedVelocity[2];
      nextSpeedTotal += Math.hypot(
        transition.preservedVelocity[0],
        transition.preservedVelocity[1],
        transition.preservedVelocity[2],
      );
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
