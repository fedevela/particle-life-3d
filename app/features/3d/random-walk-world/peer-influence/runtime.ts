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

function deriveWeightedCohesionDirection(
  deltaX: number,
  deltaY: number,
  deltaZ: number,
  neighborDistance: number,
  neighborRadius: number,
): [number, number, number] {
  if (neighborDistance <= NEAR_ZERO_EPSILON || neighborRadius <= NEAR_ZERO_EPSILON) {
    return [0, 0, 0];
  }

  const proximityWeight = Math.max(0, 1 - neighborDistance / neighborRadius);
  return [
    (deltaX / neighborDistance) * proximityWeight,
    (deltaY / neighborDistance) * proximityWeight,
    (deltaZ / neighborDistance) * proximityWeight,
  ];
}

export type NeighborSpatialIndex = {
  cellSize: number;
  radiusSquared: number;
  positions: Float32Array;
  velocities: Float32Array;
  dotCount: number;
  cellsByKey: Map<string, number[]>;
};

function toCellKey(x: number, y: number, z: number, cellSize: number) {
  return `${Math.floor(x / cellSize)}|${Math.floor(y / cellSize)}|${Math.floor(z / cellSize)}`;
}

export function createNeighborSpatialIndex(
  positions: Float32Array,
  velocities: Float32Array,
  dotCount: number,
  neighborRadius: number,
): NeighborSpatialIndex | null {
  const radius = Math.max(0, neighborRadius);
  if (!Number.isFinite(radius) || radius <= 0) {
    return null;
  }

  const cellsByKey = new Map<string, number[]>();
  for (let dotIndex = 0; dotIndex < dotCount; dotIndex += 1) {
    const offset = dotIndex * 3;
    const key = toCellKey(positions[offset], positions[offset + 1], positions[offset + 2], radius);
    const indices = cellsByKey.get(key);
    if (indices) {
      indices.push(dotIndex);
    } else {
      cellsByKey.set(key, [dotIndex]);
    }
  }

  return {
    cellSize: radius,
    radiusSquared: radius * radius,
    positions,
    velocities,
    dotCount,
    cellsByKey,
  };
}

export function deriveNeighborAverageDirectionFromSpatialIndex(
  subjectDotIndex: number,
  spatialIndex: NeighborSpatialIndex | null,
  neighborCountCap: number,
): NeighborAggregateOutput {
  if (!spatialIndex) {
    return {
      neighborCount: 0,
      averageDirection: [0, 0, 0],
      usedNeutralFallback: true,
    };
  }

  if (subjectDotIndex < 0 || subjectDotIndex >= spatialIndex.dotCount) {
    return {
      neighborCount: 0,
      averageDirection: [0, 0, 0],
      usedNeutralFallback: true,
    };
  }

  const subjectOffset = subjectDotIndex * 3;
  const subjectX = spatialIndex.positions[subjectOffset];
  const subjectY = spatialIndex.positions[subjectOffset + 1];
  const subjectZ = spatialIndex.positions[subjectOffset + 2];
  const centerX = Math.floor(subjectX / spatialIndex.cellSize);
  const centerY = Math.floor(subjectY / spatialIndex.cellSize);
  const centerZ = Math.floor(subjectZ / spatialIndex.cellSize);
  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const key = `${centerX + dx}|${centerY + dy}|${centerZ + dz}`;
        const candidateIndices = spatialIndex.cellsByKey.get(key);
        if (!candidateIndices) {
          continue;
        }

        for (const candidateIndex of candidateIndices) {
          if (candidateIndex === subjectDotIndex) {
            continue;
          }

          if (candidateIndex < 0 || candidateIndex >= spatialIndex.dotCount) {
            continue;
          }
          const candidateOffset = candidateIndex * 3;

          const deltaX = spatialIndex.positions[candidateOffset] - subjectX;
          const deltaY = spatialIndex.positions[candidateOffset + 1] - subjectY;
          const deltaZ = spatialIndex.positions[candidateOffset + 2] - subjectZ;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
          if (distanceSquared > spatialIndex.radiusSquared) {
            continue;
          }

          const velocityX = spatialIndex.velocities[candidateOffset];
          const velocityY = spatialIndex.velocities[candidateOffset + 1];
          const velocityZ = spatialIndex.velocities[candidateOffset + 2];
          const speed = Math.hypot(velocityX, velocityY, velocityZ);
          if (speed <= NEAR_ZERO_EPSILON) {
            continue;
          }
          if (neighborCount >= maxNeighbors) {
            continue;
          }

          neighborCount += 1;
          sumX += velocityX / speed;
          sumY += velocityY / speed;
          sumZ += velocityZ / speed;
        }
      }
    }
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

export function deriveNeighborCohesionDirectionFromSpatialIndex(
  subjectDotIndex: number,
  spatialIndex: NeighborSpatialIndex | null,
  neighborCountCap: number,
): [number, number, number] {
  if (!spatialIndex) {
    return [0, 0, 0];
  }

  if (subjectDotIndex < 0 || subjectDotIndex >= spatialIndex.dotCount) {
    return [0, 0, 0];
  }

  const subjectOffset = subjectDotIndex * 3;
  const subjectX = spatialIndex.positions[subjectOffset];
  const subjectY = spatialIndex.positions[subjectOffset + 1];
  const subjectZ = spatialIndex.positions[subjectOffset + 2];
  const centerX = Math.floor(subjectX / spatialIndex.cellSize);
  const centerY = Math.floor(subjectY / spatialIndex.cellSize);
  const centerZ = Math.floor(subjectZ / spatialIndex.cellSize);
  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let cohesionSumX = 0;
  let cohesionSumY = 0;
  let cohesionSumZ = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const key = `${centerX + dx}|${centerY + dy}|${centerZ + dz}`;
        const candidateIndices = spatialIndex.cellsByKey.get(key);
        if (!candidateIndices) {
          continue;
        }

        for (const candidateIndex of candidateIndices) {
          if (candidateIndex === subjectDotIndex || candidateIndex < 0 || candidateIndex >= spatialIndex.dotCount) {
            continue;
          }
          const candidateOffset = candidateIndex * 3;
          const deltaX = spatialIndex.positions[candidateOffset] - subjectX;
          const deltaY = spatialIndex.positions[candidateOffset + 1] - subjectY;
          const deltaZ = spatialIndex.positions[candidateOffset + 2] - subjectZ;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
          if (distanceSquared > spatialIndex.radiusSquared) {
            continue;
          }
          if (neighborCount >= maxNeighbors) {
            continue;
          }

          neighborCount += 1;
          const neighborDistance = Math.sqrt(distanceSquared);
          const weightedDirection = deriveWeightedCohesionDirection(
            deltaX,
            deltaY,
            deltaZ,
            neighborDistance,
            spatialIndex.cellSize,
          );
          cohesionSumX += weightedDirection[0];
          cohesionSumY += weightedDirection[1];
          cohesionSumZ += weightedDirection[2];
        }
      }
    }
  }

  if (neighborCount === 0) {
    return [0, 0, 0];
  }

  return normalizeVector([cohesionSumX / neighborCount, cohesionSumY / neighborCount, cohesionSumZ / neighborCount]);
}

export function deriveNeighborSeparationDirectionFromSpatialIndex(
  subjectDotIndex: number,
  spatialIndex: NeighborSpatialIndex | null,
  neighborCountCap: number,
): [number, number, number] {
  if (!spatialIndex) {
    return [0, 0, 0];
  }

  if (subjectDotIndex < 0 || subjectDotIndex >= spatialIndex.dotCount) {
    return [0, 0, 0];
  }

  const subjectOffset = subjectDotIndex * 3;
  const subjectX = spatialIndex.positions[subjectOffset];
  const subjectY = spatialIndex.positions[subjectOffset + 1];
  const subjectZ = spatialIndex.positions[subjectOffset + 2];
  const centerX = Math.floor(subjectX / spatialIndex.cellSize);
  const centerY = Math.floor(subjectY / spatialIndex.cellSize);
  const centerZ = Math.floor(subjectZ / spatialIndex.cellSize);
  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let separationSumX = 0;
  let separationSumY = 0;
  let separationSumZ = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const key = `${centerX + dx}|${centerY + dy}|${centerZ + dz}`;
        const candidateIndices = spatialIndex.cellsByKey.get(key);
        if (!candidateIndices) {
          continue;
        }

        for (const candidateIndex of candidateIndices) {
          if (candidateIndex === subjectDotIndex || candidateIndex < 0 || candidateIndex >= spatialIndex.dotCount) {
            continue;
          }
          const candidateOffset = candidateIndex * 3;
          const deltaX = spatialIndex.positions[candidateOffset] - subjectX;
          const deltaY = spatialIndex.positions[candidateOffset + 1] - subjectY;
          const deltaZ = spatialIndex.positions[candidateOffset + 2] - subjectZ;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
          if (distanceSquared > spatialIndex.radiusSquared) {
            continue;
          }
          if (neighborCount >= maxNeighbors) {
            continue;
          }

          neighborCount += 1;
          const distance = Math.sqrt(distanceSquared);
          const cohesionDirection = deriveWeightedCohesionDirection(
            deltaX,
            deltaY,
            deltaZ,
            distance,
            spatialIndex.cellSize,
          );
          separationSumX -= cohesionDirection[0];
          separationSumY -= cohesionDirection[1];
          separationSumZ -= cohesionDirection[2];
        }
      }
    }
  }

  if (neighborCount === 0) {
    return [0, 0, 0];
  }

  return normalizeVector([separationSumX / neighborCount, separationSumY / neighborCount, separationSumZ / neighborCount]);
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
