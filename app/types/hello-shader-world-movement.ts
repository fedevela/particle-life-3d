export type HelloShaderWorldMovementParams = {
  acceleration: number;
  directionJitter: number;
  magnitudeJitter: number;
  damping: number;
  maxSpeed: number;
};

export type HelloShaderWorldMovementParamKey = keyof HelloShaderWorldMovementParams;

type HelloShaderWorldMovementControl = {
  label: string;
  tooltip: string;
  min: number;
  max: number;
  step: number;
};

export const DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS: HelloShaderWorldMovementParams = {
  acceleration: 0.0012,
  directionJitter: 0.06,
  magnitudeJitter: 0.25,
  damping: 0.988,
  maxSpeed: 0.028,
};

export const HELLO_SHADER_WORLD_MOVEMENT_PARAM_ORDER: HelloShaderWorldMovementParamKey[] = [
  "acceleration",
  "directionJitter",
  "magnitudeJitter",
  "damping",
  "maxSpeed",
];

export const HELLO_SHADER_WORLD_MOVEMENT_CONTROLS: Record<
  HelloShaderWorldMovementParamKey,
  HelloShaderWorldMovementControl
> = {
  acceleration: {
    label: "Acceleration",
    tooltip: "Base acceleration applied along heading.",
    min: 0,
    max: 0.01,
    step: 0.0001,
  },
  directionJitter: {
    label: "Direction Jitter",
    tooltip: "Random heading drift per frame.",
    min: 0,
    max: 0.4,
    step: 0.01,
  },
  magnitudeJitter: {
    label: "Magnitude Jitter",
    tooltip: "Random acceleration strength variation.",
    min: 0,
    max: 1,
    step: 0.01,
  },
  damping: {
    label: "Damping",
    tooltip: "Velocity kept each step after drag.",
    min: 0.9,
    max: 1,
    step: 0.001,
  },
  maxSpeed: {
    label: "Max Speed",
    tooltip: "Hard cap for particle speed.",
    min: 0.003,
    max: 0.08,
    step: 0.001,
  },
};

export function clampHelloShaderWorldMovementParams(
  value: HelloShaderWorldMovementParams,
): HelloShaderWorldMovementParams {
  return {
    acceleration: clampMovementParam("acceleration", value.acceleration),
    directionJitter: clampMovementParam("directionJitter", value.directionJitter),
    magnitudeJitter: clampMovementParam("magnitudeJitter", value.magnitudeJitter),
    damping: clampMovementParam("damping", value.damping),
    maxSpeed: clampMovementParam("maxSpeed", value.maxSpeed),
  };
}

export function parseHelloShaderWorldMovementParams(
  value: unknown,
): HelloShaderWorldMovementParams | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  const candidateAcceleration =
    toFiniteNumber(record.acceleration) ?? DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS.acceleration;
  const candidateDirectionJitter =
    toFiniteNumber(record.directionJitter) ?? DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS.directionJitter;
  const candidateMagnitudeJitter =
    toFiniteNumber(record.magnitudeJitter) ?? DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS.magnitudeJitter;
  const candidateDamping = toFiniteNumber(record.damping) ?? DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS.damping;
  const candidateMaxSpeed =
    toFiniteNumber(record.maxSpeed) ?? DEFAULT_HELLO_SHADER_WORLD_MOVEMENT_PARAMS.maxSpeed;

  const candidate = {
    acceleration: candidateAcceleration,
    directionJitter: candidateDirectionJitter,
    magnitudeJitter: candidateMagnitudeJitter,
    damping: candidateDamping,
    maxSpeed: candidateMaxSpeed,
  };

  return clampHelloShaderWorldMovementParams({
    acceleration: candidate.acceleration,
    directionJitter: candidate.directionJitter,
    magnitudeJitter: candidate.magnitudeJitter,
    damping: candidate.damping,
    maxSpeed: candidate.maxSpeed,
  });
}

function clampMovementParam(key: HelloShaderWorldMovementParamKey, value: number) {
  const control = HELLO_SHADER_WORLD_MOVEMENT_CONTROLS[key];
  const bounded = Math.min(control.max, Math.max(control.min, value));

  if (key === "damping") {
    return Math.min(0.9999, bounded);
  }

  return bounded;
}

function toFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}
