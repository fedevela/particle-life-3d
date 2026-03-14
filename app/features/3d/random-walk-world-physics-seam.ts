import type {
  DotKinematics,
  RandomWalkWorldParams,
  ToroidalBoundary,
  ToroidalWrapTransition,
} from "~/types/random-walk-world";

/** Issue #32 architecture seam mapping: CH-001, CH-003. */
export const ISSUE_32_RANDOM_WALK_PHYSICS_SEAM = {
  requirementIds: ["CH-001", "CH-003"] as const,
  owner: "app/features/3d/random-walk-world-physics-seam.ts",
} as const;

export type RandomWalkSimulationHandle = {
  dispose: () => void;
};

/**
 * Define the feature-owned integration port for random-walk runtime implementation.
 * This phase declares the seam only; implementation binds in later phases.
 */
export type RandomWalkToroidalPhysicsPort = {
  initializeSimulation: (params: RandomWalkWorldParams) => RandomWalkSimulationHandle;
  deriveToroidalWrapTransition: (dot: DotKinematics, boundary: ToroidalBoundary) => ToroidalWrapTransition;
};

function wrapAxis(value: number, min: number, max: number) {
  if (value >= min && value <= max) {
    return value;
  }

  const span = max - min;
  if (span <= 0) {
    return min;
  }

  const normalized = (value - min) % span;
  return normalized < 0 ? normalized + span + min : normalized + min;
}

function computeToroidalWrapTransition(dot: DotKinematics, boundary: ToroidalBoundary): ToroidalWrapTransition {
  const x = wrapAxis(dot.position[0], boundary.min[0], boundary.max[0]);
  const y = wrapAxis(dot.position[1], boundary.min[1], boundary.max[1]);
  const z = wrapAxis(dot.position[2], boundary.min[2], boundary.max[2]);

  return {
    wrapOccurred: x !== dot.position[0] || y !== dot.position[1] || z !== dot.position[2],
    nextPosition: [x, y, z],
    preservedVelocity: dot.velocity,
  };
}

export function createRandomWalkToroidalPhysicsPort(): RandomWalkToroidalPhysicsPort {
  return {
    initializeSimulation: () => ({
      dispose: () => {},
    }),
    deriveToroidalWrapTransition: computeToroidalWrapTransition,
  };
}
