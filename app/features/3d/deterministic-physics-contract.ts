/**
 * @requirement SWARM-002
 * @description Particles remain stationary in 3D space in the absence of impulses.
 *
 * @requirement SWARM-003
 * @description Velocity decay via friction constant reduces motion over time.
 *
 * @requirement SWARM-006
 * @description Particles are constrained within defined 3D volume boundaries.
 *
 * @requirement SWARM-007
 * @description Stochastic behavior is derived from a single injectable random seed.
 */

/** Define the square texture size used by GPU simulation state. */
export const PHYSICS_TEXTURE_SIZE = 32;
export const PHYSICS_PARTICLE_CAPACITY = PHYSICS_TEXTURE_SIZE * PHYSICS_TEXTURE_SIZE;
/** Define exact frame numbers where the physics publishes milestone contracts. */
export const PHYSICS_MILESTONE_FRAMES = [0, 30, 60, 90] as const;

/** Define configurable parameters for the Deterministic Physics simulation. */
export interface PhysicsBaselineSimulationParams {
  friction: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  deltaTime: number;
}

export const DEFAULT_PHYSICS_PARAMS: PhysicsBaselineSimulationParams = {
  friction: 0.1,
  boundsMin: [-10, -10, -10],
  boundsMax: [10, 10, 10],
  deltaTime: 1 / 60,
};

/** Define the state snapshot for the Deterministic Physics Baseline. */
export type PhysicsBaselineSnapshot = {
  frame: number;
  seed: string;
  particles: Array<{
    id: number;
    px: number;
    py: number;
    pz: number;
    vx: number;
    vy: number;
    vz: number;
  }>;
};

/**
 * TRACEABILITY INTERFACE: Window integration points for contract verification.
 * These will be implemented in subsequent phases to support Playwright verification.
 */
export interface DeterministicPhysicsTestApi {
  /** Verification Obligation: GET_PHYSICS_BASELINE_CONTRACT_TEXT (Requirement Traceability) */
  __GET_PHYSICS_BASELINE_CONTRACT_TEXT__?: (frame?: number) => Promise<string>;
  /** Verification Obligation: RESET_PHYSICS_BASELINE_SIM_FOR_TEST (Requirement Traceability) */
  __RESET_PHYSICS_BASELINE_SIM_FOR_TEST__?: () => Promise<void>;
}

/** 
 * ARCHITECTURE: Deterministic Physics Verification Utilities
 * These utilities ensure that the simulation state adheres to the canonical requirements.
 */
export const PhysicsVerification = {
  /** [SWARM-006] Verify that all particles are within the defined 3D volume. */
  isWithinBounds: (p: { px: number; py: number; pz: number }, params: PhysicsBaselineSimulationParams): boolean => {
    return (
      p.px >= params.boundsMin[0] && p.px <= params.boundsMax[0] &&
      p.py >= params.boundsMin[1] && p.py <= params.boundsMax[1] &&
      p.pz >= params.boundsMin[2] && p.pz <= params.boundsMax[2]
    );
  },

  /** [SWARM-002] Verify if a particle is stationary. */
  isStationary: (p: { vx: number; vy: number; vz: number }): boolean => {
    const EPSILON = 0.0001;
    return Math.abs(p.vx) < EPSILON && Math.abs(p.vy) < EPSILON && Math.abs(p.vz) < EPSILON;
  }
};

/** Normalize one numeric value into stable two-decimal contract text. */
function formatTwoDecimals(value: number) {
  const formatted = value.toFixed(2);
  return formatted === "-0.00" ? "0.00" : formatted;
}

/**
 * Return deterministic text for the Physics Baseline simulation snapshot.
 *
 * This is used by Playwright contract tests to verify behavioral regression.
 */
export function getPhysicsBaselineContractText(snapshot: PhysicsBaselineSnapshot, params: PhysicsBaselineSimulationParams = DEFAULT_PHYSICS_PARAMS) {
  const particleCount = snapshot.particles.length;

  let sumPX = 0, sumPY = 0, sumPZ = 0;
  let sumVX = 0, sumVY = 0, sumVZ = 0;
  let outOfBoundsCount = 0;
  let stationaryCount = 0;

  snapshot.particles.forEach((p) => {
    sumPX += p.px;
    sumPY += p.py;
    sumPZ += p.pz;
    sumVX += p.vx;
    sumVY += p.vy;
    sumVZ += p.vz;
    
    if (!PhysicsVerification.isWithinBounds(p, params)) {
      outOfBoundsCount++;
    }
    if (PhysicsVerification.isStationary(p)) {
      stationaryCount++;
    }
  });

  const lines = [
    "[deterministic-physics-baseline]",
    `frame=${snapshot.frame}`,
    `seed=${snapshot.seed}`,
    `particle_count=${particleCount}`,
    `avg_p=${formatTwoDecimals(particleCount > 0 ? sumPX / particleCount : 0)},${formatTwoDecimals(particleCount > 0 ? sumPY / particleCount : 0)},${formatTwoDecimals(particleCount > 0 ? sumPZ / particleCount : 0)}`,
    `avg_v=${formatTwoDecimals(particleCount > 0 ? sumVX / particleCount : 0)},${formatTwoDecimals(particleCount > 0 ? sumVY / particleCount : 0)},${formatTwoDecimals(particleCount > 0 ? sumVZ / particleCount : 0)}`,
    `out_of_bounds=${outOfBoundsCount}`,
    `stationary=${stationaryCount}`,
  ];

  return `${lines.join("\n")}\n`;
}
