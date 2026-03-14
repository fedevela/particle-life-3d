import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import type { RandomWalkWorldParams } from "~/types/random-walk-world";

const RANDOM_WALK_FIXED_FPS = 60;
const RANDOM_WALK_FRAME_DURATION_MS = 1000 / RANDOM_WALK_FIXED_FPS;
const MAX_CAPTURED_CONTRACT_FRAMES = 2048;

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function formatScalar(value: number) {
  return value.toFixed(4);
}

export function getRandomWalkFrameForTimeMs(timeMs: number) {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return 0;
  }

  return Math.round(timeMs / RANDOM_WALK_FRAME_DURATION_MS);
}

export class RandomWalkWorldSimulation {
  private readonly params: RandomWalkWorldParams;
  private readonly seed: string;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly captureContractFrames: boolean;
  private readonly contractsByFrame = new Map<number, string>();
  private readonly physicsPort = createRandomWalkToroidalPhysicsPort();
  private rngState: number;
  private frame = 0;

  constructor(params: RandomWalkWorldParams, seed: string, captureContractFrames = false) {
    this.params = params;
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
    const boundary = {
      min: [-this.params.boundaryExtent, -this.params.boundaryExtent, -this.params.boundaryExtent] as const,
      max: [this.params.boundaryExtent, this.params.boundaryExtent, this.params.boundaryExtent] as const,
    };
    const maxSpeed = this.params.stepScale * 3;

    for (let index = 0; index < this.params.dotCount; index += 1) {
      const offset = index * 3;
      let vx = this.velocities[offset];
      let vy = this.velocities[offset + 1];
      let vz = this.velocities[offset + 2];

      vx += this.nextSignedRandom() * this.params.stepScale * 0.15;
      vy += this.nextSignedRandom() * this.params.stepScale * 0.15;
      vz += this.nextSignedRandom() * this.params.stepScale * 0.15;

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

      this.positions[offset] = transition.nextPosition[0];
      this.positions[offset + 1] = transition.nextPosition[1];
      this.positions[offset + 2] = transition.nextPosition[2];
      this.velocities[offset] = transition.preservedVelocity[0];
      this.velocities[offset + 1] = transition.preservedVelocity[1];
      this.velocities[offset + 2] = transition.preservedVelocity[2];
    }

    this.frame += 1;
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
    this.rngState ^= this.rngState << 13;
    this.rngState ^= this.rngState >>> 17;
    this.rngState ^= this.rngState << 5;
    return (this.rngState >>> 0) / 4294967296;
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
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let sumSpeed = 0;
    let maxRadius = 0;

    for (let index = 0; index < this.params.dotCount; index += 1) {
      const offset = index * 3;
      const x = this.positions[offset];
      const y = this.positions[offset + 1];
      const z = this.positions[offset + 2];
      const vx = this.velocities[offset];
      const vy = this.velocities[offset + 1];
      const vz = this.velocities[offset + 2];

      sumX += x;
      sumY += y;
      sumZ += z;
      sumSpeed += Math.hypot(vx, vy, vz);
      maxRadius = Math.max(maxRadius, Math.hypot(x, y, z));
    }

    const dotCount = this.params.dotCount || 1;
    const sample0 = this.sampleAt(0);
    const sample1 = this.sampleAt(1);
    const sample2 = this.sampleAt(2);

    const bodyLines = [
      "[random-walk]",
      `frame=${this.frame}`,
      `dot_count=${this.params.dotCount}`,
      `step_scale=${formatScalar(this.params.stepScale)}`,
      `boundary_extent=${formatScalar(this.params.boundaryExtent)}`,
      `avg_x=${formatScalar(sumX / dotCount)}`,
      `avg_y=${formatScalar(sumY / dotCount)}`,
      `avg_z=${formatScalar(sumZ / dotCount)}`,
      `avg_speed=${formatScalar(sumSpeed / dotCount)}`,
      `max_radius=${formatScalar(maxRadius)}`,
      `sample_0=${sample0}`,
      `sample_1=${sample1}`,
      `sample_2=${sample2}`,
    ];

    const checksum = hashString(bodyLines.join("\n"));
    return [...bodyLines, `checksum=${checksum}`].join("\n");
  }

  private sampleAt(index: number) {
    const offset = index * 3;
    if (offset + 2 >= this.positions.length) {
      return "0.0000,0.0000,0.0000,0.0000,0.0000,0.0000";
    }

    return [
      formatScalar(this.positions[offset]),
      formatScalar(this.positions[offset + 1]),
      formatScalar(this.positions[offset + 2]),
      formatScalar(this.velocities[offset]),
      formatScalar(this.velocities[offset + 1]),
      formatScalar(this.velocities[offset + 2]),
    ].join(",");
  }
}
