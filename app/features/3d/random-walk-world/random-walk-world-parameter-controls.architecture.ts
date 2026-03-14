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
import {
  deriveCameraContinuityGuardPlan,
  deriveFrictionHaltingPlan,
  deriveRealtimePhysicsPropagationPlan as deriveRealtimePhysicsPropagationPseudocodePlan,
  deriveSeedResetPlan,
  deriveSmoothFrameProgressionPlan,
} from "~/features/3d/random-walk-world/random-walk-world-parameter-controls.pseudocode";

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
  if (normalizedUiSeed.length > 0) {
    const seedResetPlan = deriveSeedResetPlan({
      requestedSeed: normalizedUiSeed,
      previousSeed: input.querySeed && input.querySeed.length > 0 ? input.querySeed : input.sessionSeed,
      currentFrame: 0,
    });
    return {
      effectiveSeed: normalizedUiSeed,
      seedSource: "ui-control",
      shouldResetSimulation: seedResetPlan.shouldResetSimulation,
      obligationsSatisfied: ["CH-002"],
    };
  }

  if (input.querySeed && input.querySeed.length > 0) {
    return {
      effectiveSeed: input.querySeed,
      seedSource: "query-param",
      shouldResetSimulation: false,
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
  const frictionHaltingPlan = deriveFrictionHaltingPlan({
    previousFriction: input.ambientFriction,
    nextFriction: input.ambientFriction,
    postForceVelocityMagnitude: input.peerImpulseScale,
  });
  return {
    owner: "simulation-frame-step",
    normalizedFrictionFactor: Math.min(1, Math.max(0, input.ambientFriction)),
    preservesImpulseOwnership: input.peerImpulseScale >= 0 && frictionHaltingPlan.expectedHaltingTrend === "no-change",
    obligationsSatisfied: ["CH-006"],
  };
}

function deriveRealtimePhysicsPropagationPlan(
  input: RealtimePhysicsPropagationInput,
): RealtimePhysicsPropagationPlan {
  const propagationPlan = deriveRealtimePhysicsPropagationPseudocodePlan({
    latestUiPhysicsParamsVersion: input.latestUiPhysicsParamsVersion,
    lastAppliedPhysicsParamsVersion: input.lastAppliedPhysicsParamsVersion,
    frameNumber: input.frameNumber,
  });
  const shouldApplyOnCurrentFrame = propagationPlan.applyOnFrame === input.frameNumber;
  return {
    applyOnFrame: propagationPlan.applyOnFrame,
    shouldApplyOnCurrentFrame,
    requiresSimulationReconstruction: false,
    obligationsSatisfied: ["CH-007"],
  };
}

function deriveCameraContinuityPlan(input: CameraContinuityInput): CameraContinuityPlan {
  const guardPlan = deriveCameraContinuityGuardPlan(input);
  return {
    controlsChanged: guardPlan.controlsChanged,
    preserveDefaultOrbitBindings: !guardPlan.controlsChanged,
    keepCenterLock: guardPlan.keepCenterLock,
    obligationsSatisfied: ["CH-009"],
  };
}

function deriveFrameProgressionPlan(input: FrameProgressionInput): FrameProgressionPlan {
  const progressionPlan = deriveSmoothFrameProgressionPlan({
    frameDurationMs: input.frameDurationMs,
    previousVelocityMagnitude: input.previousAverageSpeed,
    nextVelocityMagnitude: input.nextAverageSpeed,
    wrapOccurred: input.wrapOccurred,
  });
  const velocityDelta = Math.abs(input.nextAverageSpeed - input.previousAverageSpeed);
  return {
    velocityDelta,
    jitterRisk: progressionPlan.jitterRisk,
    teleportRisk: progressionPlan.teleportRisk,
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
