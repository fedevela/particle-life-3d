/**
 * @requirement SWARM-001
 * @description Define the simulation state contract for Swarm-Walk.
 */

/** Define one Swarm-Walk state snapshot used to generate text contracts for tests. */
export type SwarmWalkSnapshot = {
  frame: number;
  peers: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
  }>;
};

/** Normalize one numeric value into stable two-decimal contract text. */
function formatTwoDecimals(value: number) {
  const formatted = value.toFixed(2);
  return formatted === "-0.00" ? "0.00" : formatted;
}

function toStableSixDecimals(value: number) {
  const formatted = value.toFixed(6);
  return formatted === "-0.000000" ? "0.000000" : formatted;
}

function toHex16(value: bigint) {
  return value.toString(16).padStart(16, "0");
}

function updateFvn1a64(hash: bigint, input: string) {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let nextHash = hash;

  for (let index = 0; index < input.length; index += 1) {
    nextHash ^= BigInt(input.charCodeAt(index));
    nextHash = (nextHash * prime) & mask;
  }

  return nextHash;
}

/**
 * Return deterministic text for one Swarm-Walk simulation snapshot.
 *
 * This is used by Playwright contract tests to verify behavioral regression.
 */
export function getSwarmWalkContractText(snapshot: SwarmWalkSnapshot) {
  const peerCount = snapshot.peers.length;

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let maxRadius = 0;
  let checksumA = 0xcbf29ce484222325n;
  let checksumB = 0x84222325cbf29cen;

  snapshot.peers.forEach((peer, index) => {
    const radius = Math.hypot(peer.x, peer.y, peer.z);
    sumX += peer.x;
    sumY += peer.y;
    sumZ += peer.z;
    maxRadius = Math.max(maxRadius, radius);

    const rowA = [
      index,
      toStableSixDecimals(peer.x),
      toStableSixDecimals(peer.y),
      toStableSixDecimals(peer.z),
    ].join("|");
    const rowB = [
      index,
      toStableSixDecimals(peer.z),
      toStableSixDecimals(peer.y),
      toStableSixDecimals(peer.x),
    ].join("|");

    checksumA = updateFvn1a64(checksumA, rowA);
    checksumB = updateFvn1a64(checksumB, rowB);
  });

  const checksum = `${toHex16(checksumA)}${toHex16(checksumB)}`;

  const sampleIndexes = [0, Math.floor(peerCount / 2), peerCount - 1].filter(
    (idx) => idx >= 0 && idx < peerCount
  );
  
  const sampleLines = sampleIndexes.map((sampleIndex, orderIndex) => {
    const peer = snapshot.peers[sampleIndex];
    return `sample_${orderIndex}=${formatTwoDecimals(peer.x)},${formatTwoDecimals(peer.y)},${formatTwoDecimals(peer.z)}`;
  });

  const lines = [
    "[swarm-walk]",
    `frame=${snapshot.frame}`,
    `peer_count=${peerCount}`,
    `avg_x=${formatTwoDecimals(peerCount > 0 ? sumX / peerCount : 0)}`,
    `avg_y=${formatTwoDecimals(peerCount > 0 ? sumY / peerCount : 0)}`,
    `avg_z=${formatTwoDecimals(peerCount > 0 ? sumZ / peerCount : 0)}`,
    `max_radius=${formatTwoDecimals(maxRadius)}`,
    `checksum=${checksum}`,
    ...sampleLines,
  ];

  return `${lines.join("\n")}\n`;
}
