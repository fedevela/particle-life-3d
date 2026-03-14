export type Issue34RequirementId = "CH-002" | "CH-006" | "CH-007" | "CH-009" | "CH-010";

export type Issue34LogicObligation = {
  id: Issue34RequirementId;
  obligation: string;
  verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts";
  owningPseudocodeLocus: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts";
  runtimeLoci: readonly string[];
  requirementCases: readonly string[];
};

export const ISSUE_34_LOGIC_OBLIGATIONS: readonly Issue34LogicObligation[] = [
  {
    id: "CH-002",
    obligation:
      "Seed updates must reset deterministic random state so identical seed values reproduce identical movement contracts across runs.",
    verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/simulation/random-walk-simulation-rng.ts",
    ],
    requirementCases: [
      "CH-002 seed-parameter-change reproduces identical movement pattern across runs with same seed",
      "CH-002 determinism proof seam remains text-contract readable after seed-controlled reset",
    ],
  },
  {
    id: "CH-006",
    obligation:
      "Friction parameter edits must change post-force halting behavior so higher friction halts faster and lower friction carries longer.",
    verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    runtimeLoci: [
      "app/state/ui-store.ts",
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/peer-influence/runtime.ts",
    ],
    requirementCases: [
      "CH-006 friction-control decrease increases post-force residual motion window before halt",
      "CH-006 friction-control increase decreases post-force residual motion window before halt",
    ],
  },
  {
    id: "CH-007",
    obligation:
      "Physics parameter edits must propagate on the next simulation frame without requiring scene reload or simulation replacement.",
    verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    runtimeLoci: [
      "app/state/ui-store.ts",
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
    ],
    requirementCases: [
      "CH-007 physics-parameter-control update applies on next simulation frame without restart",
      "CH-007 repeated parameter edits preserve real-time state continuity and avoid stale values",
    ],
  },
  {
    id: "CH-009",
    obligation:
      "Camera keyboard/mouse/drag/touch/orbit/pan/zoom controls must remain unchanged while parameter controls are edited.",
    verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "tests/random-walk-world/random-walk-world.ui.spec.ts",
    ],
    requirementCases: [
      "CH-009 camera keyboard-mouse-drag-touch controls remain behaviorally unchanged during parameter edits",
      "CH-009 orbit-pan-zoom controls retain default center-lock unless user explicit move occurs",
    ],
  },
  {
    id: "CH-010",
    obligation:
      "Frame integration must preserve smooth progression with bounded velocity/wrap transitions to avoid jitter, teleporting, or uncontrolled acceleration.",
    verificationLocus: "tests/random-walk-world.traceability.phase-5.spec.ts",
    owningPseudocodeLocus:
      "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    runtimeLoci: [
      "app/features/3d/random-walk-world/random-walk-world-page.tsx",
      "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
      "app/features/3d/random-walk-world/random-walk-world-physics-seam.ts",
    ],
    requirementCases: [
      "CH-010 frame-update cadence preserves smooth motion without jitter spikes",
      "CH-010 frame-update integration prevents teleporting and uncontrolled acceleration",
    ],
  },
] as const;

export type Issue34PseudocodeLocus = {
  requirementId: Issue34RequirementId;
  owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts";
  pseudocodeArtifacts: readonly string[];
};

export const ISSUE_34_PSEUDOCODE_LOCI: readonly Issue34PseudocodeLocus[] = [
  {
    requirementId: "CH-002",
    owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    pseudocodeArtifacts: ["deriveSeedResetPlan", "SeedResetInput", "SeedResetPlanOutput"],
  },
  {
    requirementId: "CH-006",
    owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    pseudocodeArtifacts: ["deriveFrictionHaltingPlan", "FrictionHaltingInput", "FrictionHaltingPlanOutput"],
  },
  {
    requirementId: "CH-007",
    owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    pseudocodeArtifacts: [
      "deriveRealtimePhysicsPropagationPlan",
      "RealtimePhysicsPropagationInput",
      "RealtimePhysicsPropagationOutput",
    ],
  },
  {
    requirementId: "CH-009",
    owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    pseudocodeArtifacts: ["deriveCameraContinuityGuardPlan", "CameraContinuityInput", "CameraContinuityOutput"],
  },
  {
    requirementId: "CH-010",
    owner: "app/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode.ts",
    pseudocodeArtifacts: ["deriveSmoothFrameProgressionPlan", "FrameProgressionInput", "FrameProgressionOutput"],
  },
] as const;

export type SeedResetInput = {
  requestedSeed: string;
  previousSeed: string;
  currentFrame: number;
};

export type SeedResetPlanOutput = {
  shouldResetSimulation: boolean;
  orderedSteps: readonly [
    "resolve-seed-change",
    "rehash-seed-state",
    "reinitialize-dot-positions-and-velocities",
    "capture-contract-frame-zero"
  ];
  obligationsSatisfied: readonly ["CH-002"];
};

export type FrictionHaltingInput = {
  previousFriction: number;
  nextFriction: number;
  postForceVelocityMagnitude: number;
};

export type FrictionHaltingPlanOutput = {
  expectedHaltingTrend: "halt-faster" | "halt-slower" | "no-change";
  orderedSteps: readonly [
    "read-updated-friction-control",
    "compute-next-frame-friction-decay",
    "compare-post-force-residual-motion-window",
    "record-halting-direction-obligation"
  ];
  obligationsSatisfied: readonly ["CH-006", "CH-007"];
};

export type RealtimePhysicsPropagationInput = {
  latestUiPhysicsParamsVersion: number;
  lastAppliedPhysicsParamsVersion: number;
  frameNumber: number;
};

export type RealtimePhysicsPropagationOutput = {
  applyOnFrame: number;
  requiresSimulationReconstruction: false;
  orderedSteps: readonly [
    "read-ui-physics-params-snapshot",
    "derive-frame-plan-with-latest-params",
    "apply-updated-params-to-frame-step",
    "preserve-existing-position-and-velocity-state"
  ];
  obligationsSatisfied: readonly ["CH-007"];
};

export type CameraContinuityInput = {
  controlsBoundBeforeEdit: readonly string[];
  controlsBoundAfterEdit: readonly string[];
  userCameraMoveDetected: boolean;
};

export type CameraContinuityOutput = {
  controlsChanged: boolean;
  keepCenterLock: boolean;
  orderedSteps: readonly [
    "capture-control-bindings-before-parameter-edit",
    "apply-parameter-edit-without-rebinding-controls",
    "assert-bindings-match-pre-edit-state",
    "honor-user-driven-camera-movement-only"
  ];
  obligationsSatisfied: readonly ["CH-009"];
};

export type FrameProgressionInput = {
  frameDurationMs: number;
  previousVelocityMagnitude: number;
  nextVelocityMagnitude: number;
  wrapOccurred: boolean;
};

export type FrameProgressionOutput = {
  jitterRisk: "low" | "medium" | "high";
  teleportRisk: "none" | "guarded";
  orderedSteps: readonly [
    "step-with-fixed-frame-duration",
    "apply-bounded-velocity-clamp",
    "integrate-toroidal-wrap-transition",
    "capture-deterministic-contract-frame"
  ];
  obligationsSatisfied: readonly ["CH-010"];
};

export type DeriveSeedResetPlan = (input: SeedResetInput) => SeedResetPlanOutput;
export type DeriveFrictionHaltingPlan = (input: FrictionHaltingInput) => FrictionHaltingPlanOutput;
export type DeriveRealtimePhysicsPropagationPlan = (
  input: RealtimePhysicsPropagationInput,
) => RealtimePhysicsPropagationOutput;
export type DeriveCameraContinuityGuardPlan = (input: CameraContinuityInput) => CameraContinuityOutput;
export type DeriveSmoothFrameProgressionPlan = (input: FrameProgressionInput) => FrameProgressionOutput;

export const deriveSeedResetPlan: DeriveSeedResetPlan = (input) => {
  const shouldResetSimulation = input.requestedSeed !== input.previousSeed;
  return {
    shouldResetSimulation,
    orderedSteps: [
      "resolve-seed-change",
      "rehash-seed-state",
      "reinitialize-dot-positions-and-velocities",
      "capture-contract-frame-zero",
    ],
    obligationsSatisfied: ["CH-002"],
  };
};

export const deriveFrictionHaltingPlan: DeriveFrictionHaltingPlan = (input) => {
  const expectedHaltingTrend =
    input.nextFriction > input.previousFriction
      ? "halt-faster"
      : input.nextFriction < input.previousFriction
        ? "halt-slower"
        : "no-change";
  void input.postForceVelocityMagnitude;

  return {
    expectedHaltingTrend,
    orderedSteps: [
      "read-updated-friction-control",
      "compute-next-frame-friction-decay",
      "compare-post-force-residual-motion-window",
      "record-halting-direction-obligation",
    ],
    obligationsSatisfied: ["CH-006", "CH-007"],
  };
};

export const deriveRealtimePhysicsPropagationPlan: DeriveRealtimePhysicsPropagationPlan = (input) => {
  const hasPendingUiPhysicsUpdate =
    input.latestUiPhysicsParamsVersion > input.lastAppliedPhysicsParamsVersion;
  return {
    applyOnFrame: hasPendingUiPhysicsUpdate ? input.frameNumber : input.frameNumber + 1,
    requiresSimulationReconstruction: false,
    orderedSteps: [
      "read-ui-physics-params-snapshot",
      "derive-frame-plan-with-latest-params",
      "apply-updated-params-to-frame-step",
      "preserve-existing-position-and-velocity-state",
    ],
    obligationsSatisfied: ["CH-007"],
  };
};

export const deriveCameraContinuityGuardPlan: DeriveCameraContinuityGuardPlan = (input) => {
  const controlsChanged = input.controlsBoundBeforeEdit.join("|") !== input.controlsBoundAfterEdit.join("|");
  return {
    controlsChanged,
    keepCenterLock: !input.userCameraMoveDetected,
    orderedSteps: [
      "capture-control-bindings-before-parameter-edit",
      "apply-parameter-edit-without-rebinding-controls",
      "assert-bindings-match-pre-edit-state",
      "honor-user-driven-camera-movement-only",
    ],
    obligationsSatisfied: ["CH-009"],
  };
};

export const deriveSmoothFrameProgressionPlan: DeriveSmoothFrameProgressionPlan = (input) => {
  const speedDelta = Math.abs(input.nextVelocityMagnitude - input.previousVelocityMagnitude);
  const jitterRisk = speedDelta < 0.25 ? "low" : speedDelta < 0.75 ? "medium" : "high";

  return {
    jitterRisk,
    teleportRisk: input.wrapOccurred ? "guarded" : "none",
    orderedSteps: [
      "step-with-fixed-frame-duration",
      "apply-bounded-velocity-clamp",
      "integrate-toroidal-wrap-transition",
      "capture-deterministic-contract-frame",
    ],
    obligationsSatisfied: ["CH-010"],
  };
};
