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

function deriveAmbientFrictionDecayPlan(input: AmbientFrictionInput): AmbientFrictionOutput {
  return {
    decayedVelocity: input.velocity,
    reachedNearHalt: false,
  };
}

function deriveNeighborAverageDirectionPlan(): NeighborAggregateOutput {
  return {
    neighborCount: 0,
    averageDirection: [0, 0, 0],
    usedNeutralFallback: true,
  };
}

function deriveDualBiasImpulseDirectionPlan(input: DualBiasImpulseInput): DualBiasImpulseOutput {
  return {
    biasedDirection: input.randomUnitDirection,
    normalized: false,
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
