import type { RandomWalkWorldPhysicsParams } from "~/types/random-walk-world";

export type Issue34RequirementId = "CH-002" | "CH-006" | "CH-007" | "CH-009" | "CH-010";

export type Issue34ArchitecturePressure =
  | "seed-determinism-ownership"
  | "friction-halting-ownership"
  | "realtime-physics-propagation-seam"
  | "camera-control-continuity-guard"
  | "frame-progression-stability-guard";

export type Issue34ArtifactType =
  | "contract/type"
  | "structural-placement"
  | "ownership-boundary"
  | "dependency-direction"
  | "integration-seam";

export type Issue34ArchitectureLocusMapping = {
  requirementId: Issue34RequirementId;
  pressure: Issue34ArchitecturePressure;
  owningLocus: string;
  artifactType: Issue34ArtifactType;
};

export const ISSUE_34_ARCHITECTURE_LOCUS_MAPPINGS: readonly Issue34ArchitectureLocusMapping[] = [
  {
    requirementId: "CH-002",
    pressure: "seed-determinism-ownership",
    owningLocus: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.architecture.ts",
    artifactType: "integration-seam",
  },
  {
    requirementId: "CH-006",
    pressure: "friction-halting-ownership",
    owningLocus: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.architecture.ts",
    artifactType: "ownership-boundary",
  },
  {
    requirementId: "CH-007",
    pressure: "realtime-physics-propagation-seam",
    owningLocus: "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
    artifactType: "dependency-direction",
  },
  {
    requirementId: "CH-009",
    pressure: "camera-control-continuity-guard",
    owningLocus: "app/features/3d/random-walk-world/random-walk-world-page.tsx",
    artifactType: "structural-placement",
  },
  {
    requirementId: "CH-010",
    pressure: "frame-progression-stability-guard",
    owningLocus: "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
    artifactType: "contract/type",
  },
] as const;

export type SeedControlInput = {
  querySeed: string | null;
  sessionSeed: string;
  uiSeedInput: string;
};

export type SeedControlPlan = {
  effectiveSeed: string;
  seedSource: "query-param" | "ui-control" | "session-fallback";
  shouldResetSimulation: boolean;
  obligationsSatisfied: readonly ["CH-002"];
};

export type FrictionHaltingOwnershipInput = {
  ambientFriction: number;
  peerImpulseScale: number;
};

export type FrictionHaltingOwnershipPlan = {
  owner: "simulation-frame-step";
  normalizedFrictionFactor: number;
  preservesImpulseOwnership: boolean;
  obligationsSatisfied: readonly ["CH-006"];
};

export type RealtimePhysicsPropagationInput = {
  latestUiPhysicsParamsVersion: number;
  lastAppliedPhysicsParamsVersion: number;
  frameNumber: number;
  physicsParams: RandomWalkWorldPhysicsParams;
};

export type RealtimePhysicsPropagationPlan = {
  applyOnFrame: number;
  shouldApplyOnCurrentFrame: boolean;
  requiresSimulationReconstruction: false;
  obligationsSatisfied: readonly ["CH-007"];
};

export type CameraContinuityInput = {
  controlsBoundBeforeEdit: readonly string[];
  controlsBoundAfterEdit: readonly string[];
  userCameraMoveDetected: boolean;
};

export type CameraContinuityPlan = {
  controlsChanged: boolean;
  preserveDefaultOrbitBindings: boolean;
  keepCenterLock: boolean;
  obligationsSatisfied: readonly ["CH-009"];
};

export type FrameProgressionInput = {
  frameDurationMs: number;
  previousAverageSpeed: number;
  nextAverageSpeed: number;
  wrapOccurred: boolean;
};

export type FrameProgressionPlan = {
  velocityDelta: number;
  jitterRisk: "low" | "medium" | "high";
  teleportRisk: "none" | "guarded";
  obligationsSatisfied: readonly ["CH-010"];
};

export type RandomWalkWorldParameterControlsArchitecturePort = {
  deriveSeedControlPlan: (input: SeedControlInput) => SeedControlPlan;
  deriveFrictionHaltingOwnershipPlan: (
    input: FrictionHaltingOwnershipInput,
  ) => FrictionHaltingOwnershipPlan;
  deriveRealtimePhysicsPropagationPlan: (
    input: RealtimePhysicsPropagationInput,
  ) => RealtimePhysicsPropagationPlan;
  deriveCameraContinuityPlan: (input: CameraContinuityInput) => CameraContinuityPlan;
  deriveFrameProgressionPlan: (input: FrameProgressionInput) => FrameProgressionPlan;
};
