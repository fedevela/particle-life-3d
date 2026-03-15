import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  createNeighborSpatialIndex,
  deriveSpatialIndexBucketStats,
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

type RandomWalkSimulationProfilingOptions = {
  enabled: boolean;
  logEveryFrames?: number;
  label?: string;
  includeSpatialStats?: boolean;
};

type SimulationProfileSample = {
  mode: RandomWalkWorldPhysicsParams["mode"];
  dotCount: number;
  totalMs: number;
  framePlanMs: number;
  indexBuildMs: number;
  integrationMs: number;
  progressionMs: number;
  neighborCellCount: number;
  separationCellCount: number;
  neighborMaxBucketSize: number;
  separationMaxBucketSize: number;
  neighborAvgBucketSize: number;
  separationAvgBucketSize: number;
};

type ProfileAccumulator = {
  sampleCount: number;
  dotCountTotal: number;
  totalMs: number;
  framePlanMs: number;
  indexBuildMs: number;
  integrationMs: number;
  progressionMs: number;
  neighborCellCount: number;
  separationCellCount: number;
  neighborMaxBucketSize: number;
  separationMaxBucketSize: number;
  neighborAvgBucketSize: number;
  separationAvgBucketSize: number;
};

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function createProfileAccumulator(): ProfileAccumulator {
  return {
    sampleCount: 0,
    dotCountTotal: 0,
    totalMs: 0,
    framePlanMs: 0,
    indexBuildMs: 0,
    integrationMs: 0,
    progressionMs: 0,
    neighborCellCount: 0,
    separationCellCount: 0,
    neighborMaxBucketSize: 0,
    separationMaxBucketSize: 0,
    neighborAvgBucketSize: 0,
    separationAvgBucketSize: 0,
  };
}

function resetProfileAccumulator(acc: ProfileAccumulator) {
  acc.sampleCount = 0;
  acc.dotCountTotal = 0;
  acc.totalMs = 0;
  acc.framePlanMs = 0;
  acc.indexBuildMs = 0;
  acc.integrationMs = 0;
  acc.progressionMs = 0;
  acc.neighborCellCount = 0;
  acc.separationCellCount = 0;
  acc.neighborMaxBucketSize = 0;
  acc.separationMaxBucketSize = 0;
  acc.neighborAvgBucketSize = 0;
  acc.separationAvgBucketSize = 0;
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
  private readonly massNoiseByDot: Float32Array;
  private readonly captureContractFrames: boolean;
  private readonly contractsByFrame = new Map<number, string>();
  private readonly physicsPort = createRandomWalkToroidalPhysicsPort();
  private rngState: number;
  private physicsParamsVersion = 0;
  private lastAppliedPhysicsParamsVersion = -1;
  private frame = 0;
  private readonly profilingEnabled: boolean;
  private readonly profilingLogEveryFrames: number;
  private readonly profilingLabel: string;
  private readonly profilingIncludeSpatialStats: boolean;
  private readonly overallProfileAccumulator = createProfileAccumulator();
  private readonly regularModeProfileAccumulator = createProfileAccumulator();
  private readonly peerModeProfileAccumulator = createProfileAccumulator();

  constructor(
    params: RandomWalkWorldParams,
    seed: string,
    captureContractFrames = false,
    physicsParams: RandomWalkWorldPhysicsParams = DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS,
    profilingOptions: RandomWalkSimulationProfilingOptions = { enabled: false },
  ) {
    this.params = params;
    this.physicsParams = physicsParams;
    this.seed = seed;
    this.captureContractFrames = captureContractFrames;
    this.positions = new Float32Array(params.dotCount * 3);
    this.velocities = new Float32Array(params.dotCount * 3);
    this.massNoiseByDot = new Float32Array(params.dotCount);
    this.rngState = hashSeed(seed);
    this.profilingEnabled = profilingOptions.enabled;
    this.profilingLogEveryFrames = Math.max(1, Math.floor(profilingOptions.logEveryFrames ?? 120));
    this.profilingLabel = profilingOptions.label ?? "random-walk";
    this.profilingIncludeSpatialStats = profilingOptions.includeSpatialStats ?? false;
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
    const stepStartedAt = this.profilingEnabled ? nowMs() : 0;
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
    const framePlanDoneAt = this.profilingEnabled ? nowMs() : 0;

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
    const indexBuildDoneAt = this.profilingEnabled ? nowMs() : 0;
    const neighborIndexStats = this.profilingEnabled
      ? this.deriveSpatialIndexStats(neighborSpatialIndex)
      : null;
    const separationIndexStats = this.profilingEnabled
      ? this.deriveSpatialIndexStats(separationSpatialIndex)
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
    const integrationDoneAt = this.profilingEnabled ? nowMs() : 0;

    assessFrameProgression({
      frameDurationMs: RANDOM_WALK_FRAME_DURATION_MS,
      previousAverageSpeed: previousSpeedTotal / this.params.dotCount,
      nextAverageSpeed: nextSpeedTotal / this.params.dotCount,
      wrapOccurred,
    });
    const progressionDoneAt = this.profilingEnabled ? nowMs() : 0;

    this.frame += 1;
    this.captureFrameContract(this.frame);

    if (this.profilingEnabled) {
      this.recordProfileSample({
        mode: framePlan.mode,
        dotCount: this.params.dotCount,
        totalMs: progressionDoneAt - stepStartedAt,
        framePlanMs: framePlanDoneAt - stepStartedAt,
        indexBuildMs: indexBuildDoneAt - framePlanDoneAt,
        integrationMs: integrationDoneAt - indexBuildDoneAt,
        progressionMs: progressionDoneAt - integrationDoneAt,
        neighborCellCount: neighborIndexStats?.cellCount ?? 0,
        separationCellCount: separationIndexStats?.cellCount ?? 0,
        neighborMaxBucketSize: neighborIndexStats?.maxBucketSize ?? 0,
        separationMaxBucketSize: separationIndexStats?.maxBucketSize ?? 0,
        neighborAvgBucketSize: neighborIndexStats?.avgBucketSize ?? 0,
        separationAvgBucketSize: separationIndexStats?.avgBucketSize ?? 0,
      });
    }
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

  private recordProfileSample(sample: SimulationProfileSample) {
    this.accumulateProfileSample(this.overallProfileAccumulator, sample);
    const modeAccumulator =
      sample.mode === "regular-random-walk"
        ? this.regularModeProfileAccumulator
        : this.peerModeProfileAccumulator;
    this.accumulateProfileSample(modeAccumulator, sample);

    if (this.overallProfileAccumulator.sampleCount < this.profilingLogEveryFrames) {
      return;
    }

    this.logProfileAccumulator("all", this.overallProfileAccumulator);
    this.logProfileAccumulator("regular-random-walk", this.regularModeProfileAccumulator);
    this.logProfileAccumulator("peer-influenced-random-walk", this.peerModeProfileAccumulator);

    resetProfileAccumulator(this.overallProfileAccumulator);
    resetProfileAccumulator(this.regularModeProfileAccumulator);
    resetProfileAccumulator(this.peerModeProfileAccumulator);
  }

  private accumulateProfileSample(acc: ProfileAccumulator, sample: SimulationProfileSample) {
    acc.sampleCount += 1;
    acc.dotCountTotal += sample.dotCount;
    acc.totalMs += sample.totalMs;
    acc.framePlanMs += sample.framePlanMs;
    acc.indexBuildMs += sample.indexBuildMs;
    acc.integrationMs += sample.integrationMs;
    acc.progressionMs += sample.progressionMs;
    acc.neighborCellCount += sample.neighborCellCount;
    acc.separationCellCount += sample.separationCellCount;
    acc.neighborMaxBucketSize = Math.max(acc.neighborMaxBucketSize, sample.neighborMaxBucketSize);
    acc.separationMaxBucketSize = Math.max(acc.separationMaxBucketSize, sample.separationMaxBucketSize);
    acc.neighborAvgBucketSize += sample.neighborAvgBucketSize;
    acc.separationAvgBucketSize += sample.separationAvgBucketSize;
  }

  private logProfileAccumulator(scope: string, acc: ProfileAccumulator) {
    if (acc.sampleCount <= 0) {
      return;
    }

    const divisor = acc.sampleCount;
    const baseParts = [
      `[random-walk-profiler:${this.profilingLabel}]`,
      `scope=${scope}`,
      `frame=${this.frame}`,
      `samples=${divisor}`,
      `avg_dots=${(acc.dotCountTotal / divisor).toFixed(1)}`,
      `avg_total_ms=${(acc.totalMs / divisor).toFixed(3)}`,
      `avg_frame_plan_ms=${(acc.framePlanMs / divisor).toFixed(3)}`,
      `avg_index_build_ms=${(acc.indexBuildMs / divisor).toFixed(3)}`,
      `avg_integration_ms=${(acc.integrationMs / divisor).toFixed(3)}`,
      `avg_progression_ms=${(acc.progressionMs / divisor).toFixed(3)}`,
    ];

    if (this.profilingIncludeSpatialStats) {
      baseParts.push(
        `avg_neighbor_cells=${(acc.neighborCellCount / divisor).toFixed(1)}`,
        `avg_separation_cells=${(acc.separationCellCount / divisor).toFixed(1)}`,
        `avg_neighbor_bucket=${(acc.neighborAvgBucketSize / divisor).toFixed(3)}`,
        `avg_separation_bucket=${(acc.separationAvgBucketSize / divisor).toFixed(3)}`,
        `max_neighbor_bucket=${acc.neighborMaxBucketSize}`,
        `max_separation_bucket=${acc.separationMaxBucketSize}`,
      );
    }

    console.info(baseParts.join(" "));
  }

  private deriveSpatialIndexStats(
    spatialIndex: ReturnType<typeof createNeighborSpatialIndex>,
  ): { cellCount: number; avgBucketSize: number; maxBucketSize: number } | null {
    if (!spatialIndex) {
      return null;
    }

    return deriveSpatialIndexBucketStats(spatialIndex);
  }
}
