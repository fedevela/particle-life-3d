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
  let checksum = 0;

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
    checksum += (index + 1) * ((next.x * 0.37) + (next.y * 0.53) + (next.vx * 0.71) + (next.vy * 0.97));
  }

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
    `checksum=${formatTwoDecimals(checksum)}`,
    ...sampleLines,
  ];

  return `${lines.join("\n")}\n`;
}
