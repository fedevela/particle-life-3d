import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  deriveAmbientFrictionDecayPlan,
  deriveDualBiasImpulseDirectionPlan,
  deriveFrameUpdatePlan,
  deriveNeighborAverageDirectionPlan,
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

function normalizeDirection(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

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
    this.rngState = hashSeed(seed);
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

    const boundary = {
      min: [-this.params.boundaryExtent, -this.params.boundaryExtent, -this.params.boundaryExtent] as const,
      max: [this.params.boundaryExtent, this.params.boundaryExtent, this.params.boundaryExtent] as const,
    };
    const maxSpeed = this.params.stepScale * 3;
    let previousSpeedTotal = 0;
    let nextSpeedTotal = 0;
    let wrapOccurred = false;
    const frameDots =
      framePlan.mode === "peer-influenced-random-walk"
        ? Array.from({ length: this.params.dotCount }, (_, dotIndex) => {
            const offset = dotIndex * 3;
            return {
              dotIndex,
              position: [
                this.positions[offset],
                this.positions[offset + 1],
                this.positions[offset + 2],
              ] as const,
              velocity: [
                this.velocities[offset],
                this.velocities[offset + 1],
                this.velocities[offset + 2],
              ] as const,
            };
          })
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
        });
        vx = friction.decayedVelocity[0];
        vy = friction.decayedVelocity[1];
        vz = friction.decayedVelocity[2];

        const velocityDirection = normalizeDirection(vx, vy, vz);
        const neighborAggregate = deriveNeighborAverageDirectionPlan({
          subjectDotIndex: index,
          neighborRadius: this.physicsParams.peerInfluenceRadius,
          frameDots: frameDots ?? [],
        });
        const randomDirection = normalizeDirection(
          this.nextSignedRandom(),
          this.nextSignedRandom(),
          this.nextSignedRandom(),
        );
        const impulseDirection = deriveDualBiasImpulseDirectionPlan({
          randomUnitDirection: randomDirection,
          currentVelocityDirection: velocityDirection,
          peerAverageDirection: neighborAggregate.averageDirection,
          velocityBiasWeight: this.physicsParams.velocityBiasWeight,
          peerBiasWeight: this.physicsParams.peerBiasWeight,
        });

        vx += impulseDirection.biasedDirection[0] * this.params.stepScale * this.physicsParams.peerImpulseScale;
        vy += impulseDirection.biasedDirection[1] * this.params.stepScale * this.physicsParams.peerImpulseScale;
        vz += impulseDirection.biasedDirection[2] * this.params.stepScale * this.physicsParams.peerImpulseScale;
      }

      const speed = Math.hypot(vx, vy, vz);
      if (speed > maxSpeed && speed > 0) {
        const ratio = maxSpeed / speed;
        vx *= ratio;
        vy *= ratio;
        vz *= ratio;
      }

      const transition = this.physicsPort.deriveToroidalWrapTransition(
        {
          position: [
            this.positions[offset] + vx,
            this.positions[offset + 1] + vy,
            this.positions[offset + 2] + vz,
          ],
          velocity: [vx, vy, vz],
        },
        boundary,
      );
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
      dotCount: this.params.dotCount,
      stepScale: this.params.stepScale,
      boundaryExtent: this.params.boundaryExtent,
      ambientFriction: this.physicsParams.ambientFriction,
      peerInfluenceRadius: this.physicsParams.peerInfluenceRadius,
      velocityBiasWeight: this.physicsParams.velocityBiasWeight,
      peerBiasWeight: this.physicsParams.peerBiasWeight,
      peerImpulseScale: this.physicsParams.peerImpulseScale,
      positions: this.positions,
      velocities: this.velocities,
    });
  }
}
