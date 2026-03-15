import type {
  AmbientFrictionInput,
  AmbientFrictionOutput,
  DualBiasImpulseInput,
  DualBiasImpulseOutput,
} from "~/features/3d/random-walk-world/peer-influence/contracts";

export const NEAR_ZERO_EPSILON = 1e-6;
const NEAR_HALT_EPSILON = 1e-3;

export function clampUnitInterval(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function vectorLength(vector: readonly [number, number, number]) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalizeVector(vector: readonly [number, number, number]): [number, number, number] {
  const length = vectorLength(vector);
  if (length <= NEAR_ZERO_EPSILON) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function addScaledVector(
  base: readonly [number, number, number],
  scalar: number,
  source: readonly [number, number, number],
): [number, number, number] {
  return [base[0] + source[0] * scalar, base[1] + source[1] * scalar, base[2] + source[2] * scalar];
}

export function deriveAmbientFrictionDecayPlan(input: AmbientFrictionInput): AmbientFrictionOutput {
  const friction = clampUnitInterval(input.frictionFactor);
  const dampingCurve = Math.max(0.25, input.dampingCurve);
  const keepRatio = Math.pow(1 - friction, dampingCurve);
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

export function deriveDualBiasImpulseDirectionPlan(input: DualBiasImpulseInput): DualBiasImpulseOutput {
  const randomDirection = normalizeVector(input.randomUnitDirection);
  const velocityDirection = normalizeVector(input.currentVelocityDirection);
  const peerDirection = normalizeVector(input.peerAverageDirection);
  const cohesionDirection = normalizeVector(input.peerCohesionDirection);
  const separationDirection = normalizeVector(input.peerSeparationDirection);
  const centerDirection = normalizeVector(input.centerAttractionDirection);
  const randomWeight = Math.max(0, input.randomImpulseWeight);
  const velocityWeight = Math.max(0, input.velocityBiasWeight);
  const peerWeight = Math.max(0, input.peerBiasWeight);
  const cohesionWeight = Math.max(0, input.peerCohesionWeight);
  const separationWeight = Math.max(0, input.peerSeparationWeight);
  const centerAttractionWeight = Math.max(0, input.centerAttractionWeight);

  let combined = [
    randomDirection[0] * randomWeight,
    randomDirection[1] * randomWeight,
    randomDirection[2] * randomWeight,
  ] as const;
  if (velocityWeight > 0) {
    combined = addScaledVector(combined, velocityWeight, velocityDirection);
  }
  if (peerWeight > 0) {
    combined = addScaledVector(combined, peerWeight, peerDirection);
  }
  if (cohesionWeight > 0) {
    combined = addScaledVector(combined, cohesionWeight, cohesionDirection);
  }
  if (separationWeight > 0) {
    combined = addScaledVector(combined, separationWeight, separationDirection);
  }
  if (centerAttractionWeight > 0) {
    combined = addScaledVector(combined, centerAttractionWeight, centerDirection);
  }

  const normalizedDirection = normalizeVector(combined);
  const usedFallback = vectorLength(normalizedDirection) <= NEAR_ZERO_EPSILON;

  return {
    biasedDirection: usedFallback ? randomDirection : normalizedDirection,
    normalized: true,
    bounded: true,
  };
}
