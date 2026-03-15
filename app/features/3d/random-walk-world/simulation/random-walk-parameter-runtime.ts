export type ResolveRandomWalkSeedInput = {
  querySeed: string | null;
  sessionSeed: string;
  uiSeedInput: string;
};

export type ResolveRandomWalkSeedOutput = {
  effectiveSeed: string;
  seedSource: "query-param" | "ui-control" | "session-fallback";
};

export function resolveRandomWalkSeed(input: ResolveRandomWalkSeedInput): ResolveRandomWalkSeedOutput {
  const normalizedUiSeed = input.uiSeedInput.trim();
  if (normalizedUiSeed.length > 0) {
    return {
      effectiveSeed: normalizedUiSeed,
      seedSource: "ui-control",
    };
  }

  if (input.querySeed && input.querySeed.length > 0) {
    return {
      effectiveSeed: input.querySeed,
      seedSource: "query-param",
    };
  }

  return {
    effectiveSeed: input.sessionSeed,
    seedSource: "session-fallback",
  };
}

export function normalizeAmbientFriction(ambientFriction: number) {
  if (!Number.isFinite(ambientFriction)) {
    return 0;
  }

  return Math.min(1, Math.max(0, ambientFriction));
}

export type RealtimePhysicsSyncInput = {
  latestUiPhysicsParamsVersion: number;
  lastAppliedPhysicsParamsVersion: number;
};

export function shouldApplyRealtimePhysicsParams(input: RealtimePhysicsSyncInput) {
  return input.latestUiPhysicsParamsVersion > input.lastAppliedPhysicsParamsVersion;
}

export type FrameProgressionAssessmentInput = {
  frameDurationMs: number;
  previousAverageSpeed: number;
  nextAverageSpeed: number;
  wrapOccurred: boolean;
};

export type FrameProgressionAssessment = {
  velocityDelta: number;
  jitterRisk: "low" | "medium" | "high";
  teleportRisk: "none" | "guarded";
};

export function assessFrameProgression(input: FrameProgressionAssessmentInput): FrameProgressionAssessment {
  void input.frameDurationMs;
  const velocityDelta = Math.abs(input.nextAverageSpeed - input.previousAverageSpeed);

  return {
    velocityDelta,
    jitterRisk: velocityDelta < 0.25 ? "low" : velocityDelta < 0.75 ? "medium" : "high",
    teleportRisk: input.wrapOccurred ? "guarded" : "none",
  };
}
