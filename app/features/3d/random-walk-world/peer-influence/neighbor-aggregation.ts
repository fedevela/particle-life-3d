import type { NeighborAggregateInput, NeighborAggregateOutput } from "~/features/3d/random-walk-world/peer-influence/contracts";
import { forEachSpatialNeighbor, type NeighborSpatialIndex } from "~/features/3d/random-walk-world/peer-influence/spatial-index";
import { NEAR_ZERO_EPSILON, normalizeVector, vectorLength } from "~/features/3d/random-walk-world/peer-influence/vector-blending";

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

  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  forEachSpatialNeighbor(subjectDotIndex, spatialIndex, (candidateIndex) => {
    const candidateOffset = candidateIndex * 3;
    const velocityX = spatialIndex.velocities[candidateOffset];
    const velocityY = spatialIndex.velocities[candidateOffset + 1];
    const velocityZ = spatialIndex.velocities[candidateOffset + 2];
    const speed = Math.hypot(velocityX, velocityY, velocityZ);
    if (speed <= NEAR_ZERO_EPSILON || neighborCount >= maxNeighbors) {
      return;
    }

    neighborCount += 1;
    sumX += velocityX / speed;
    sumY += velocityY / speed;
    sumZ += velocityZ / speed;
  });

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

  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let cohesionSumX = 0;
  let cohesionSumY = 0;
  let cohesionSumZ = 0;

  forEachSpatialNeighbor(subjectDotIndex, spatialIndex, (_, deltaX, deltaY, deltaZ, distanceSquared) => {
    if (neighborCount >= maxNeighbors) {
      return;
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
  });

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

  let neighborCount = 0;
  const maxNeighbors = Math.max(1, Math.floor(neighborCountCap));
  let separationSumX = 0;
  let separationSumY = 0;
  let separationSumZ = 0;

  forEachSpatialNeighbor(subjectDotIndex, spatialIndex, (_, deltaX, deltaY, deltaZ, distanceSquared) => {
    if (neighborCount >= maxNeighbors) {
      return;
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
  });

  if (neighborCount === 0) {
    return [0, 0, 0];
  }

  return normalizeVector([separationSumX / neighborCount, separationSumY / neighborCount, separationSumZ / neighborCount]);
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
