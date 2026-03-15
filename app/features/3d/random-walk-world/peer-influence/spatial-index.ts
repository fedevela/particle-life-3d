export type NeighborSpatialIndex = {
  cellSize: number;
  radiusSquared: number;
  positions: Float32Array;
  velocities: Float32Array;
  dotCount: number;
  cellsByX: Map<number, Map<number, Map<number, number[]>>>;
};

function toCellCoordinate(value: number, cellSize: number) {
  return Math.floor(value / cellSize);
}

function getOrCreateBucket(
  cellsByX: Map<number, Map<number, Map<number, number[]>>>,
  x: number,
  y: number,
  z: number,
) {
  let cellsByY = cellsByX.get(x);
  if (!cellsByY) {
    cellsByY = new Map<number, Map<number, number[]>>();
    cellsByX.set(x, cellsByY);
  }

  let cellsByZ = cellsByY.get(y);
  if (!cellsByZ) {
    cellsByZ = new Map<number, number[]>();
    cellsByY.set(y, cellsByZ);
  }

  let bucket = cellsByZ.get(z);
  if (!bucket) {
    bucket = [];
    cellsByZ.set(z, bucket);
  }

  return bucket;
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

  const cellsByX = new Map<number, Map<number, Map<number, number[]>>>();
  for (let dotIndex = 0; dotIndex < dotCount; dotIndex += 1) {
    const offset = dotIndex * 3;
    const cellX = toCellCoordinate(positions[offset], radius);
    const cellY = toCellCoordinate(positions[offset + 1], radius);
    const cellZ = toCellCoordinate(positions[offset + 2], radius);
    const bucket = getOrCreateBucket(cellsByX, cellX, cellY, cellZ);
    bucket.push(dotIndex);
  }

  return {
    cellSize: radius,
    radiusSquared: radius * radius,
    positions,
    velocities,
    dotCount,
    cellsByX,
  };
}

export function forEachSpatialNeighbor(
  subjectDotIndex: number,
  spatialIndex: NeighborSpatialIndex,
  visitor: (
    candidateIndex: number,
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    distanceSquared: number,
  ) => boolean | void,
) {
  const subjectOffset = subjectDotIndex * 3;
  const subjectX = spatialIndex.positions[subjectOffset];
  const subjectY = spatialIndex.positions[subjectOffset + 1];
  const subjectZ = spatialIndex.positions[subjectOffset + 2];
  const centerX = toCellCoordinate(subjectX, spatialIndex.cellSize);
  const centerY = toCellCoordinate(subjectY, spatialIndex.cellSize);
  const centerZ = toCellCoordinate(subjectZ, spatialIndex.cellSize);

  for (let dx = -1; dx <= 1; dx += 1) {
    const cellsByY = spatialIndex.cellsByX.get(centerX + dx);
    if (!cellsByY) {
      continue;
    }

    for (let dy = -1; dy <= 1; dy += 1) {
      const cellsByZ = cellsByY.get(centerY + dy);
      if (!cellsByZ) {
        continue;
      }

      for (let dz = -1; dz <= 1; dz += 1) {
        const candidateIndices = cellsByZ.get(centerZ + dz);
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

          const shouldStop = visitor(candidateIndex, deltaX, deltaY, deltaZ, distanceSquared);
          if (shouldStop === true) {
            return;
          }
        }
      }
    }
  }
}

export function deriveSpatialIndexBucketStats(spatialIndex: NeighborSpatialIndex) {
  let bucketCount = 0;
  let totalBucketSize = 0;
  let maxBucketSize = 0;

  for (const cellsByY of spatialIndex.cellsByX.values()) {
    for (const cellsByZ of cellsByY.values()) {
      for (const bucket of cellsByZ.values()) {
        bucketCount += 1;
        totalBucketSize += bucket.length;
        if (bucket.length > maxBucketSize) {
          maxBucketSize = bucket.length;
        }
      }
    }
  }

  return {
    cellCount: bucketCount,
    avgBucketSize: bucketCount > 0 ? totalBucketSize / bucketCount : 0,
    maxBucketSize,
  };
}
