type ContractSnapshotInput = {
  frame: number;
  dotCount: number;
  stepScale: number;
  boundaryExtent: number;
  mode: "regular-random-walk" | "peer-influenced-random-walk";
  boundaryMode: "wrap-around" | "bounce-back" | "edge-trap";
  ambientFriction: number;
  peerInfluenceRadius: number;
  randomImpulseWeight: number;
  separationWeight: number;
  separationRadius: number;
  maxSpeedMultiplier: number;
  velocityDampingCurve: number;
  neighborCountCap: number;
  centerAttraction: number;
  massVariance: number;
  velocityBiasWeight: number;
  peerBiasWeight: number;
  neighborCohesionWeight: number;
  peerImpulseScale: number;
  positions: Float32Array;
  velocities: Float32Array;
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function formatScalar(value: number) {
  return value.toFixed(4);
}

function sampleAt(index: number, positions: Float32Array, velocities: Float32Array) {
  const offset = index * 3;
  if (offset + 2 >= positions.length || offset + 2 >= velocities.length) {
    return "0.0000,0.0000,0.0000,0.0000,0.0000,0.0000";
  }

  return [
    formatScalar(positions[offset]),
    formatScalar(positions[offset + 1]),
    formatScalar(positions[offset + 2]),
    formatScalar(velocities[offset]),
    formatScalar(velocities[offset + 1]),
    formatScalar(velocities[offset + 2]),
  ].join(",");
}

export function buildRandomWalkContractText(snapshot: ContractSnapshotInput) {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let sumSpeed = 0;
  let maxRadius = 0;

  for (let index = 0; index < snapshot.dotCount; index += 1) {
    const offset = index * 3;
    const x = snapshot.positions[offset];
    const y = snapshot.positions[offset + 1];
    const z = snapshot.positions[offset + 2];
    const vx = snapshot.velocities[offset];
    const vy = snapshot.velocities[offset + 1];
    const vz = snapshot.velocities[offset + 2];

    sumX += x;
    sumY += y;
    sumZ += z;
    sumSpeed += Math.hypot(vx, vy, vz);
    maxRadius = Math.max(maxRadius, Math.hypot(x, y, z));
  }

  const safeDotCount = snapshot.dotCount || 1;
  const bodyLines = [
    "[random-walk]",
    `frame=${snapshot.frame}`,
    `mode=${snapshot.mode}`,
    `boundary_mode=${snapshot.boundaryMode}`,
    `dot_count=${snapshot.dotCount}`,
    `step_scale=${formatScalar(snapshot.stepScale)}`,
    `boundary_extent=${formatScalar(snapshot.boundaryExtent)}`,
    `ambient_friction=${formatScalar(snapshot.ambientFriction)}`,
    `peer_radius=${formatScalar(snapshot.peerInfluenceRadius)}`,
    `random_impulse=${formatScalar(snapshot.randomImpulseWeight)}`,
    `personal_space_strength=${formatScalar(snapshot.separationWeight)}`,
    `personal_space_radius=${formatScalar(snapshot.separationRadius)}`,
    `top_speed_limit=${formatScalar(snapshot.maxSpeedMultiplier)}`,
    `braking_curve=${formatScalar(snapshot.velocityDampingCurve)}`,
    `neighbor_attention=${formatScalar(snapshot.neighborCountCap)}`,
    `center_pull=${formatScalar(snapshot.centerAttraction)}`,
    `mass_diversity=${formatScalar(snapshot.massVariance)}`,
    `keep_direction=${formatScalar(snapshot.velocityBiasWeight)}`,
    `follow_neighbors=${formatScalar(snapshot.peerBiasWeight)}`,
    `collapse_pull=${formatScalar(snapshot.neighborCohesionWeight)}`,
    `push_strength=${formatScalar(snapshot.peerImpulseScale)}`,
    `avg_x=${formatScalar(sumX / safeDotCount)}`,
    `avg_y=${formatScalar(sumY / safeDotCount)}`,
    `avg_z=${formatScalar(sumZ / safeDotCount)}`,
    `avg_speed=${formatScalar(sumSpeed / safeDotCount)}`,
    `max_radius=${formatScalar(maxRadius)}`,
    `sample_0=${sampleAt(0, snapshot.positions, snapshot.velocities)}`,
    `sample_1=${sampleAt(1, snapshot.positions, snapshot.velocities)}`,
    `sample_2=${sampleAt(2, snapshot.positions, snapshot.velocities)}`,
  ];

  const checksum = hashString(bodyLines.join("\n"));
  return [...bodyLines, `checksum=${checksum}`].join("\n");
}
