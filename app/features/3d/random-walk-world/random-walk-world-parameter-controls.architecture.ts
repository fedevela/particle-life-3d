import type {
  CameraContinuityInput,
  CameraContinuityPlan,
  FrameProgressionInput,
  FrameProgressionPlan,
  FrictionHaltingOwnershipInput,
  FrictionHaltingOwnershipPlan,
  RandomWalkWorldParameterControlsArchitecturePort,
  RealtimePhysicsPropagationInput,
  RealtimePhysicsPropagationPlan,
  SeedControlInput,
  SeedControlPlan,
} from "~/features/3d/random-walk-world/random-walk-world-parameter-controls.contracts";

export * from "~/features/3d/random-walk-world/random-walk-world-parameter-controls.contracts";

/** Issue #34 architecture mapping: CH-002, CH-006, CH-007, CH-009, CH-010. */
const ISSUE_34_PARAMETER_CONTROLS_ARCHITECTURE_REQUIREMENTS = [
  "CH-002",
  "CH-006",
  "CH-007",
  "CH-009",
  "CH-010",
] as const;

function deriveSeedControlPlan(input: SeedControlInput): SeedControlPlan {
  const normalizedUiSeed = input.uiSeedInput.trim();
  if (input.querySeed && input.querySeed.length > 0) {
    return {
      effectiveSeed: input.querySeed,
      seedSource: "query-param",
      shouldResetSimulation: false,
      obligationsSatisfied: ["CH-002"],
    };
  }

  if (normalizedUiSeed.length > 0) {
    return {
      effectiveSeed: normalizedUiSeed,
      seedSource: "ui-control",
      shouldResetSimulation: normalizedUiSeed !== input.sessionSeed,
      obligationsSatisfied: ["CH-002"],
    };
  }

  return {
    effectiveSeed: input.sessionSeed,
    seedSource: "session-fallback",
    shouldResetSimulation: false,
    obligationsSatisfied: ["CH-002"],
  };
}

function deriveFrictionHaltingOwnershipPlan(
  input: FrictionHaltingOwnershipInput,
): FrictionHaltingOwnershipPlan {
  return {
    owner: "simulation-frame-step",
    normalizedFrictionFactor: Math.min(1, Math.max(0, input.ambientFriction)),
    preservesImpulseOwnership: input.peerImpulseScale >= 0,
    obligationsSatisfied: ["CH-006"],
  };
}

function deriveRealtimePhysicsPropagationPlan(
  input: RealtimePhysicsPropagationInput,
): RealtimePhysicsPropagationPlan {
  const shouldApplyOnCurrentFrame =
    input.latestUiPhysicsParamsVersion > input.lastAppliedPhysicsParamsVersion;
  return {
    applyOnFrame: shouldApplyOnCurrentFrame ? input.frameNumber : input.frameNumber + 1,
    shouldApplyOnCurrentFrame,
    requiresSimulationReconstruction: false,
    obligationsSatisfied: ["CH-007"],
  };
}

function deriveCameraContinuityPlan(input: CameraContinuityInput): CameraContinuityPlan {
  const controlsChanged = input.controlsBoundBeforeEdit.join("|") !== input.controlsBoundAfterEdit.join("|");
  return {
    controlsChanged,
    preserveDefaultOrbitBindings: !controlsChanged,
    keepCenterLock: !input.userCameraMoveDetected,
    obligationsSatisfied: ["CH-009"],
  };
}

function deriveFrameProgressionPlan(input: FrameProgressionInput): FrameProgressionPlan {
  const velocityDelta = Math.abs(input.nextAverageSpeed - input.previousAverageSpeed);
  const jitterRisk = velocityDelta < 0.25 ? "low" : velocityDelta < 0.75 ? "medium" : "high";
  return {
    velocityDelta,
    jitterRisk,
    teleportRisk: input.wrapOccurred ? "guarded" : "none",
    obligationsSatisfied: ["CH-010"],
  };
}

export function createRandomWalkWorldParameterControlsArchitecturePort(): RandomWalkWorldParameterControlsArchitecturePort {
  void ISSUE_34_PARAMETER_CONTROLS_ARCHITECTURE_REQUIREMENTS;

  return {
    deriveSeedControlPlan,
    deriveFrictionHaltingOwnershipPlan,
    deriveRealtimePhysicsPropagationPlan,
    deriveCameraContinuityPlan,
    deriveFrameProgressionPlan,
  };
}
