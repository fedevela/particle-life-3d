export type NeighborSpatialIndex = {
  cellSize: number;
  radiusSquared: number;
  inverseCellVolume: number;
  positions: Float32Array;
  velocities: Float32Array;
  dotCount: number;
  cellsByX: Map<number, Map<number, Map<number, SpatialCellData>>>;
};

type SpatialCellData = {
  indices: number[];
  occupancy: number;
  sumVelocityX: number;
  sumVelocityY: number;
  sumVelocityZ: number;
};

function toCellCoordinate(value: number, cellSize: number) {
  return Math.floor(value / cellSize);
}

function createEmptyCellData(): SpatialCellData {
  return {
    indices: [],
    occupancy: 0,
    sumVelocityX: 0,
    sumVelocityY: 0,
    sumVelocityZ: 0,
  };
}

function getOrCreateCellData(
  cellsByX: Map<number, Map<number, Map<number, SpatialCellData>>>,
  x: number,
  y: number,
  z: number,
) {
  let cellsByY = cellsByX.get(x);
  if (!cellsByY) {
    cellsByY = new Map<number, Map<number, SpatialCellData>>();
    cellsByX.set(x, cellsByY);
  }

  let cellsByZ = cellsByY.get(y);
  if (!cellsByZ) {
    cellsByZ = new Map<number, SpatialCellData>();
    cellsByY.set(y, cellsByZ);
  }

  let cell = cellsByZ.get(z);
  if (!cell) {
    cell = createEmptyCellData();
    cellsByZ.set(z, cell);
  }

  return cell;
}

function getCellData(
  cellsByX: NeighborSpatialIndex["cellsByX"],
  x: number,
  y: number,
  z: number,
) {
  return cellsByX.get(x)?.get(y)?.get(z) ?? null;
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

  const cellsByX = new Map<number, Map<number, Map<number, SpatialCellData>>>();
  for (let dotIndex = 0; dotIndex < dotCount; dotIndex += 1) {
    const offset = dotIndex * 3;
    const cellX = toCellCoordinate(positions[offset], radius);
    const cellY = toCellCoordinate(positions[offset + 1], radius);
    const cellZ = toCellCoordinate(positions[offset + 2], radius);
    const cell = getOrCreateCellData(cellsByX, cellX, cellY, cellZ);

    cell.indices.push(dotIndex);
    cell.occupancy += 1;
    cell.sumVelocityX += velocities[offset];
    cell.sumVelocityY += velocities[offset + 1];
    cell.sumVelocityZ += velocities[offset + 2];
  }

  return {
    cellSize: radius,
    radiusSquared: radius * radius,
    inverseCellVolume: 1 / (radius * radius * radius),
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
        const cell = cellsByZ.get(centerZ + dz);
        if (!cell) {
          continue;
        }

        for (const candidateIndex of cell.indices) {
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
      for (const cell of cellsByZ.values()) {
        const bucketSize = cell.indices.length;
        bucketCount += 1;
        totalBucketSize += bucketSize;
        if (bucketSize > maxBucketSize) {
          maxBucketSize = bucketSize;
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

export function deriveDensityFieldSample(
  spatialIndex: NeighborSpatialIndex | null,
  positionX: number,
  positionY: number,
  positionZ: number,
) {
  if (!spatialIndex) {
    return {
      density: 0,
      densityPerVolume: 0,
      gradientX: 0,
      gradientY: 0,
      gradientZ: 0,
      flowX: 0,
      flowY: 0,
      flowZ: 0,
    };
  }

  const centerX = toCellCoordinate(positionX, spatialIndex.cellSize);
  const centerY = toCellCoordinate(positionY, spatialIndex.cellSize);
  const centerZ = toCellCoordinate(positionZ, spatialIndex.cellSize);
  let density = 0;
  let gradientX = 0;
  let gradientY = 0;
  let gradientZ = 0;
  let flowX = 0;
  let flowY = 0;
  let flowZ = 0;
  let weightTotal = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cell = getCellData(spatialIndex.cellsByX, centerX + dx, centerY + dy, centerZ + dz);
        if (!cell || cell.occupancy <= 0) {
          continue;
        }

        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const weight = distanceSquared === 0 ? 1 : 1 / (1 + distanceSquared);
        const weightedDensity = cell.occupancy * weight;
        density += weightedDensity;
        gradientX += weightedDensity * dx;
        gradientY += weightedDensity * dy;
        gradientZ += weightedDensity * dz;
        flowX += (cell.sumVelocityX / cell.occupancy) * weight;
        flowY += (cell.sumVelocityY / cell.occupancy) * weight;
        flowZ += (cell.sumVelocityZ / cell.occupancy) * weight;
        weightTotal += weight;
      }
    }
  }

  if (weightTotal > 0) {
    flowX /= weightTotal;
    flowY /= weightTotal;
    flowZ /= weightTotal;
  }

  return {
    density,
    densityPerVolume: density * spatialIndex.inverseCellVolume,
    gradientX,
    gradientY,
    gradientZ,
    flowX,
    flowY,
    flowZ,
  };
}
