/**
 * @requirement SWARM-001
 * @description Define the simulation state contract for Swarm-Walk.
 */

/** Define one Swarm-Walk state snapshot used to generate text contracts for tests. */
export type SwarmWalkSnapshot = {
  frame: number;
  entities: Array<{
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

/**
 * Return deterministic text for one Swarm-Walk simulation snapshot.
 *
 * This is used by Playwright contract tests to verify behavioral regression.
 */
export function getSwarmWalkContractText(snapshot: SwarmWalkSnapshot) {
  const entityCount = snapshot.entities.length;

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const entity of snapshot.entities) {
    sumX += entity.x;
    sumY += entity.y;
    sumZ += entity.z;
  }

  const lines = [
    "[swarm-walk]",
    `frame=${snapshot.frame}`,
    `entity_count=${entityCount}`,
    `avg_x=${formatTwoDecimals(entityCount > 0 ? sumX / entityCount : 0)}`,
    `avg_y=${formatTwoDecimals(entityCount > 0 ? sumY / entityCount : 0)}`,
    `avg_z=${formatTwoDecimals(entityCount > 0 ? sumZ / entityCount : 0)}`,
  ];

  // Include top 3 entities if they exist for more granular regression testing
  snapshot.entities.slice(0, 3).forEach((entity, index) => {
    lines.push(`entity_${index}=${formatTwoDecimals(entity.x)},${formatTwoDecimals(entity.y)},${formatTwoDecimals(entity.z)}`);
  });

  return `${lines.join("\n")}\n`;
}
