import type {
  AmbientFrictionInput,
  AmbientFrictionOutput,
  DualBiasImpulseInput,
  DualBiasImpulseOutput,
  FrameUpdatePlanInput,
  FrameUpdatePlanOutput,
  NeighborAggregateInput,
  NeighborAggregateOutput,
} from "~/features/3d/random-walk-world/peer-influence/contracts";

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

export function deriveAmbientFrictionDecayPlan(input: AmbientFrictionInput): AmbientFrictionOutput {
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

export function deriveNeighborAverageDirectionPlan(input: NeighborAggregateInput): NeighborAggregateOutput {
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

export function deriveDualBiasImpulseDirectionPlan(input: DualBiasImpulseInput): DualBiasImpulseOutput {
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

export function deriveFrameUpdatePlan(input: FrameUpdatePlanInput): FrameUpdatePlanOutput {
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
