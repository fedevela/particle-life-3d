import type {
  AmbientFrictionInput,
  AmbientFrictionOutput,
  DualBiasImpulseInput,
  DualBiasImpulseOutput,
  FrameUpdatePlanInput,
  FrameUpdatePlanOutput,
  NeighborAggregateInput,
  NeighborAggregateOutput,
} from "~/features/3d/random-walk-world/random-walk-peer-influence.pseudocode";
import type { RandomWalkWorldPhysicsParams } from "~/types/random-walk-world";

export type Issue33RequirementId = "CH-004" | "CH-005" | "CH-005-A" | "CH-008";

export type ArchitecturePressureType =
  | "ownership-boundary"
  | "dependency-direction"
  | "integration-seam"
  | "contract-shape"
  | "structural-placement";

export type RequirementArchitecturePressure = {
  requirementId: Issue33RequirementId;
  pressure: string;
  pressureType: ArchitecturePressureType;
};

export const ISSUE_33_ARCHITECTURE_PRESSURES: readonly RequirementArchitecturePressure[] = [
  {
    requirementId: "CH-004",
    pressure:
      "Frame-stage friction responsibilities need a dedicated seam so decay ownership is isolated from integration and wrapping concerns.",
    pressureType: "ownership-boundary",
  },
  {
    requirementId: "CH-005",
    pressure:
      "Neighbor aggregation requires a typed contract boundary so radius-based peer direction calculation can be implemented without leaking through UI modules.",
    pressureType: "contract-shape",
  },
  {
    requirementId: "CH-005-A",
    pressure:
      "A mode toggle parameter must flow from UI controls into simulation seams to preserve backward-compatible regular random walk behavior.",
    pressureType: "dependency-direction",
  },
  {
    requirementId: "CH-008",
    pressure:
      "Dual-bias impulse composition needs a stable integration seam for velocity-bias and peer-bias inputs before runtime math is added.",
    pressureType: "integration-seam",
  },
] as const;

export type ArchitectureArtifactType =
  | "explicit-contract-type"
  | "structural-placement"
  | "ownership-boundary"
  | "dependency-direction"
  | "integration-seam";

export type Issue33ArchitectureLocus = {
  requirementId: Issue33RequirementId;
  owner: string;
  artifactType: ArchitectureArtifactType;
  plannedFileChange: string;
};

export const ISSUE_33_ARCHITECTURE_LOCI: readonly Issue33ArchitectureLocus[] = [
  {
    requirementId: "CH-004",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.architecture.ts",
    artifactType: "ownership-boundary",
    plannedFileChange: "Define ambient-friction seam contract and no-op plan return shape.",
  },
  {
    requirementId: "CH-005",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.architecture.ts",
    artifactType: "explicit-contract-type",
    plannedFileChange: "Define neighbor-average aggregation seam contract and fallback metadata boundary.",
  },
  {
    requirementId: "CH-005-A",
    owner: "app/types/random-walk-world.ts",
    artifactType: "dependency-direction",
    plannedFileChange: "Add physics-mode toggle and typed physics parameters flowing from UI to simulation.",
  },
  {
    requirementId: "CH-008",
    owner: "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
    artifactType: "integration-seam",
    plannedFileChange: "Route dual-bias inputs through architecture port without runtime behavior implementation.",
  },
] as const;

export type RandomWalkPeerInfluenceArchitecturePort = {
  deriveAmbientFrictionDecayPlan: (input: AmbientFrictionInput) => AmbientFrictionOutput;
  deriveNeighborAverageDirectionPlan: (input: NeighborAggregateInput) => NeighborAggregateOutput;
  deriveDualBiasImpulseDirectionPlan: (input: DualBiasImpulseInput) => DualBiasImpulseOutput;
  deriveFrameUpdatePlan: (input: FrameUpdatePlanInput) => FrameUpdatePlanOutput;
};

export type RandomWalkPhysicsArchitectureBindings = {
  params: RandomWalkWorldPhysicsParams;
  port: RandomWalkPeerInfluenceArchitecturePort;
};

export const ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS = ["CH-004", "CH-005", "CH-005-A", "CH-008"] as const;

const NEAR_ZERO_EPSILON = 1e-6;
const NEAR_HALT_EPSILON = 1e-3;

function clampUnitInterval(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function vectorLength(vector: readonly [number, number, number]) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeVector(vector: readonly [number, number, number]): [number, number, number] {
  const length = vectorLength(vector);
  if (length <= NEAR_ZERO_EPSILON) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function addScaledVector(
  base: readonly [number, number, number],
  scalar: number,
  source: readonly [number, number, number],
): [number, number, number] {
  return [base[0] + source[0] * scalar, base[1] + source[1] * scalar, base[2] + source[2] * scalar];
}

function deriveAmbientFrictionDecayPlan(input: AmbientFrictionInput): AmbientFrictionOutput {
  const friction = clampUnitInterval(input.frictionFactor);
  const keepRatio = 1 - friction;
  const decayedVelocity: [number, number, number] = [
    input.velocity[0] * keepRatio,
    input.velocity[1] * keepRatio,
    input.velocity[2] * keepRatio,
  ];

  return {
    decayedVelocity,
    reachedNearHalt: vectorLength(decayedVelocity) <= NEAR_HALT_EPSILON,
  };
}

function deriveNeighborAverageDirectionPlan(input: NeighborAggregateInput): NeighborAggregateOutput {
  const radius = Math.max(0, input.neighborRadius);
  if (!Number.isFinite(radius) || radius <= 0) {
    return {
      neighborCount: 0,
      averageDirection: [0, 0, 0],
      usedNeutralFallback: true,
    };
  }

  const subject = input.frameDots[input.subjectDotIndex];
  if (!subject) {
    return {
      neighborCount: 0,
      averageDirection: [0, 0, 0],
      usedNeutralFallback: true,
    };
  }

  let neighborCount = 0;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  const radiusSquared = radius * radius;

  for (const candidate of input.frameDots) {
    if (candidate.dotIndex === subject.dotIndex) {
      continue;
    }

    const dx = candidate.position[0] - subject.position[0];
    const dy = candidate.position[1] - subject.position[1];
    const dz = candidate.position[2] - subject.position[2];
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    if (distanceSquared > radiusSquared) {
      continue;
    }

    const normalizedVelocity = normalizeVector(candidate.velocity);
    if (vectorLength(normalizedVelocity) <= NEAR_ZERO_EPSILON) {
      continue;
    }

    neighborCount += 1;
    sumX += normalizedVelocity[0];
    sumY += normalizedVelocity[1];
    sumZ += normalizedVelocity[2];
  }

  if (neighborCount === 0) {
    return {
      neighborCount: 0,
      averageDirection: [0, 0, 0],
      usedNeutralFallback: true,
    };
  }

  const averageDirection = normalizeVector([sumX / neighborCount, sumY / neighborCount, sumZ / neighborCount]);
  const usedNeutralFallback = vectorLength(averageDirection) <= NEAR_ZERO_EPSILON;

  return {
    neighborCount,
    averageDirection: usedNeutralFallback ? [0, 0, 0] : averageDirection,
    usedNeutralFallback,
  };
}

function deriveDualBiasImpulseDirectionPlan(input: DualBiasImpulseInput): DualBiasImpulseOutput {
  const randomDirection = normalizeVector(input.randomUnitDirection);
  const velocityDirection = normalizeVector(input.currentVelocityDirection);
  const peerDirection = normalizeVector(input.peerAverageDirection);
  const velocityWeight = Math.max(0, input.velocityBiasWeight);
  const peerWeight = Math.max(0, input.peerBiasWeight);

  let combined = randomDirection;
  if (velocityWeight > 0) {
    combined = addScaledVector(combined, velocityWeight, velocityDirection);
  }
  if (peerWeight > 0) {
    combined = addScaledVector(combined, peerWeight, peerDirection);
  }

  const normalizedDirection = normalizeVector(combined);
  const usedFallback = vectorLength(normalizedDirection) <= NEAR_ZERO_EPSILON;

  return {
    biasedDirection: usedFallback ? randomDirection : normalizedDirection,
    normalized: true,
    bounded: true,
  };
}

function deriveFrameUpdatePlan(input: FrameUpdatePlanInput): FrameUpdatePlanOutput {
  const orderedStages =
    input.mode === "regular-random-walk"
      ? ([
          "resolve-mode",
          "integrate-velocity-and-position",
          "enforce-bounded-stability",
        ] as const)
      : ([
          "resolve-mode",
          "apply-ambient-friction",
          "compute-peer-average-direction",
          "derive-dual-bias-impulse",
          "integrate-velocity-and-position",
          "enforce-bounded-stability",
        ] as const);

  return {
    orderedStages,
    mode: input.mode,
    obligationsSatisfied:
      input.mode === "regular-random-walk"
        ? (["CH-005-A"] as const)
        : (["CH-004", "CH-005", "CH-005-A", "CH-008"] as const),
  };
}

export function createRandomWalkPeerInfluenceArchitecturePort(): RandomWalkPeerInfluenceArchitecturePort {
  return {
    deriveAmbientFrictionDecayPlan,
    deriveNeighborAverageDirectionPlan,
    deriveDualBiasImpulseDirectionPlan,
    deriveFrameUpdatePlan,
  };
}

export function createRandomWalkPhysicsArchitectureBindings(
  params: RandomWalkWorldPhysicsParams,
): RandomWalkPhysicsArchitectureBindings {
  return {
    params,
    port: createRandomWalkPeerInfluenceArchitecturePort(),
  };
}
