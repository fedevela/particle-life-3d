export type Issue33RequirementId = "CH-004" | "CH-005" | "CH-005-A" | "CH-008";

export type RequirementLogicObligation = {
  id: Issue33RequirementId;
  obligation: string;
  verificationLocus: "tests/random-walk-world/random-walk-world.ui.spec.ts";
  owningPseudocodeLocus: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts";
  runtimeLoci: readonly string[];
  requirementCases: readonly string[];
};

export const ISSUE_33_LOGIC_OBLIGATIONS: readonly RequirementLogicObligation[] = [
  {
    id: "CH-004",
    obligation:
      "Each frame update applies ambient friction so velocity decays toward halt unless additional forces are introduced.",
    verificationLocus: "tests/random-walk-world/random-walk-world.ui.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/random-walk-world-physics-seam.ts",
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
    ],
    requirementCases: [
      "CH-004 ambient-friction.frame-update.velocity-decays-toward-halt-without-forces",
      "CH-004 ambient-friction.stability.prevents-uncontrolled-acceleration-or-teleporting",
    ],
  },
  {
    id: "CH-005",
    obligation:
      "Peer influence processing computes average movement direction from neighbors found inside a configured 3D radius.",
    verificationLocus: "tests/random-walk-world/random-walk-world.ui.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/random-walk-world-physics-seam.ts",
    ],
    requirementCases: [
      "CH-005 peer-average-direction.neighbor-radius-3d.computes-mean-direction-vector",
      "CH-005 peer-average-direction.empty-neighbor-set.falls-back-to-neutral-bias",
    ],
  },
  {
    id: "CH-005-A",
    obligation:
      "Simulation behavior remains toggleable so regular random-walk can be selected to preserve previous flows.",
    verificationLocus: "tests/random-walk-world/random-walk-world.ui.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/types/random-walk-world.ts",
    ],
    requirementCases: [
      "CH-005-A mode-toggle.peer-influence-disabled.reverts-to-regular-random-walk",
      "CH-005-A mode-toggle.peer-influence-enabled.activates-augmented-impulse-rules",
    ],
  },
  {
    id: "CH-008",
    obligation:
      "Random impulse direction is derived from both current velocity direction and peer-average direction within radius.",
    verificationLocus: "tests/random-walk-world/random-walk-world.ui.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/random-walk-world-physics-seam.ts",
    ],
    requirementCases: [
      "CH-008 dual-bias-impulse.current-velocity-and-peer-average.combine-into-impulse-direction",
      "CH-008 dual-bias-impulse.weighting.normalizes-bounded-stable-motion",
    ],
  },
] as const;

export type RandomWalkPhysicsMode = "regular-random-walk" | "peer-influenced-random-walk";

export type SimulationVector3 = readonly [x: number, y: number, z: number];

export type DotFrameState = {
  dotIndex: number;
  position: SimulationVector3;
  velocity: SimulationVector3;
};

export type NeighborAggregateInput = {
  subjectDotIndex: number;
  neighborRadius: number;
  frameDots: readonly DotFrameState[];
};

export type NeighborAggregateOutput = {
  neighborCount: number;
  averageDirection: SimulationVector3;
  usedNeutralFallback: boolean;
};

export type AmbientFrictionInput = {
  velocity: SimulationVector3;
  frictionFactor: number;
};

export type AmbientFrictionOutput = {
  decayedVelocity: SimulationVector3;
  reachedNearHalt: boolean;
};

export type DualBiasImpulseInput = {
  randomUnitDirection: SimulationVector3;
  currentVelocityDirection: SimulationVector3;
  peerAverageDirection: SimulationVector3;
  velocityBiasWeight: number;
  peerBiasWeight: number;
};

export type DualBiasImpulseOutput = {
  biasedDirection: SimulationVector3;
  normalized: boolean;
  bounded: boolean;
};

export type FrameStage =
  | "resolve-mode"
  | "apply-ambient-friction"
  | "compute-peer-average-direction"
  | "derive-dual-bias-impulse"
  | "integrate-velocity-and-position"
  | "enforce-bounded-stability";

export type FrameUpdatePlanInput = {
  mode: RandomWalkPhysicsMode;
  frictionFactor: number;
  peerRadius: number;
  velocityBiasWeight: number;
  peerBiasWeight: number;
};

export type FrameUpdatePlanOutput = {
  orderedStages: readonly FrameStage[];
  mode: RandomWalkPhysicsMode;
  obligationsSatisfied: readonly Issue33RequirementId[];
};

export type DeriveNeighborAverageDirection = (
  input: NeighborAggregateInput,
) => NeighborAggregateOutput;

export type DeriveAmbientFrictionDecay = (
  input: AmbientFrictionInput,
) => AmbientFrictionOutput;

export type DeriveDualBiasImpulseDirection = (
  input: DualBiasImpulseInput,
) => DualBiasImpulseOutput;

export type DeriveFrameUpdatePlan = (
  input: FrameUpdatePlanInput,
) => FrameUpdatePlanOutput;

export type Issue33PseudocodeLocus = {
  requirementId: Issue33RequirementId;
  owner: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts";
  pseudocodeArtifacts: readonly string[];
};

export const ISSUE_33_PSEUDOCODE_LOCI: readonly Issue33PseudocodeLocus[] = [
  {
    requirementId: "CH-004",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    pseudocodeArtifacts: ["DeriveAmbientFrictionDecay", "AmbientFrictionInput", "AmbientFrictionOutput"],
  },
  {
    requirementId: "CH-005",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    pseudocodeArtifacts: [
      "DeriveNeighborAverageDirection",
      "NeighborAggregateInput",
      "NeighborAggregateOutput",
    ],
  },
  {
    requirementId: "CH-005-A",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    pseudocodeArtifacts: ["RandomWalkPhysicsMode", "DeriveFrameUpdatePlan", "FrameUpdatePlanInput"],
  },
  {
    requirementId: "CH-008",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.pseudocode.ts",
    pseudocodeArtifacts: [
      "DeriveDualBiasImpulseDirection",
      "DualBiasImpulseInput",
      "DualBiasImpulseOutput",
    ],
  },
] as const;
