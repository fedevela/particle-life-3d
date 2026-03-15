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

type SpatialNeighborCandidate = {
  candidateIndex: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  distanceSquared: number;
};

export function forEachSpatialNeighbor(
  subjectDotIndex: number,
  spatialIndex: NeighborSpatialIndex,
  visitor: (candidate: SpatialNeighborCandidate) => boolean | void,
) {
  const subjectOffset = subjectDotIndex * 3;
  const subjectX = spatialIndex.positions[subjectOffset];
  const subjectY = spatialIndex.positions[subjectOffset + 1];
  const subjectZ = spatialIndex.positions[subjectOffset + 2];
  const centerX = Math.floor(subjectX / spatialIndex.cellSize);
  const centerY = Math.floor(subjectY / spatialIndex.cellSize);
  const centerZ = Math.floor(subjectZ / spatialIndex.cellSize);

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

          const shouldStop = visitor({
            candidateIndex,
            deltaX,
            deltaY,
            deltaZ,
            distanceSquared,
          });
          if (shouldStop === true) {
            return;
          }
        }
      }
    }
  }
}
