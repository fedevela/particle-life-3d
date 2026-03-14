/** Define one GPU readback snapshot used to generate text contracts for tests. */
export type ShaderStateSnapshot = {
  frame: number;
  textureSize: number;
  values: Float32Array;
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

/** Read one vec4 state tuple from the flat readback buffer. */
function readStateTuple(values: Float32Array, index: number) {
  const offset = index * 4;
  return {
    x: values[offset],
    y: values[offset + 1],
    vx: values[offset + 2],
    vy: values[offset + 3],
  };
}

/**
 * Return deterministic text for one shader simulation snapshot.
 *
 * This is intentionally plain text so Playwright can compare it to fixtures directly.
 */
export function getShaderContractText(snapshot: ShaderStateSnapshot) {
  const particleCount = snapshot.textureSize * snapshot.textureSize;

  if (snapshot.values.length !== particleCount * 4) {
    throw new Error(
      `Unexpected snapshot buffer size. Expected ${particleCount * 4} float entries and received ${snapshot.values.length}.`,
    );
  }

  let sumX = 0;
  let sumY = 0;
  let sumVx = 0;
  let sumVy = 0;
  let sumSpeed = 0;
  let maxRadius = 0;
  let checksumA = 0xcbf29ce484222325n;
  let checksumB = 0x84222325cbf29cen;

  for (let index = 0; index < particleCount; index += 1) {
    const next = readStateTuple(snapshot.values, index);
    const radius = Math.hypot(next.x, next.y);
    const speed = Math.hypot(next.vx, next.vy);

    sumX += next.x;
    sumY += next.y;
    sumVx += next.vx;
    sumVy += next.vy;
    sumSpeed += speed;
    maxRadius = Math.max(maxRadius, radius);
    const rowA = [
      index,
      toStableSixDecimals(next.x),
      toStableSixDecimals(next.y),
      toStableSixDecimals(next.vx),
      toStableSixDecimals(next.vy),
    ].join("|");
    const rowB = [
      index,
      toStableSixDecimals(next.vy),
      toStableSixDecimals(next.vx),
      toStableSixDecimals(next.y),
      toStableSixDecimals(next.x),
    ].join("|");

    checksumA = updateFvn1a64(checksumA, rowA);
    checksumB = updateFvn1a64(checksumB, rowB);
  }

  const checksum = `${toHex16(checksumA)}${toHex16(checksumB)}`;

  const sampleIndexes = [0, Math.floor(particleCount / 2), particleCount - 1];
  const sampleLines = sampleIndexes.map((sampleIndex, orderIndex) => {
    const sample = readStateTuple(snapshot.values, sampleIndex);
    return [
      `sample_${orderIndex}=`,
      formatTwoDecimals(sample.x),
      ",",
      formatTwoDecimals(sample.y),
      ",",
      formatTwoDecimals(sample.vx),
      ",",
      formatTwoDecimals(sample.vy),
    ].join("");
  });

  const lines = [
    "[shader]",
    `frame=${snapshot.frame}`,
    `texture_size=${snapshot.textureSize}`,
    `particle_count=${particleCount}`,
    `avg_x=${formatTwoDecimals(sumX / particleCount)}`,
    `avg_y=${formatTwoDecimals(sumY / particleCount)}`,
    `avg_vx=${formatTwoDecimals(sumVx / particleCount)}`,
    `avg_vy=${formatTwoDecimals(sumVy / particleCount)}`,
    `avg_speed=${formatTwoDecimals(sumSpeed / particleCount)}`,
    `max_radius=${formatTwoDecimals(maxRadius)}`,
    `checksum=${checksum}`,
    ...sampleLines,
  ];

  return `${lines.join("\n")}\n`;
}
