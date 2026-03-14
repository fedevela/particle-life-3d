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

export function createRandomWalkToroidalPhysicsPort(): RandomWalkToroidalPhysicsPort {
  return {
    initializeSimulation: () => ({
      dispose: () => {},
    }),
    deriveToroidalWrapTransition: (dot) => ({
      wrapOccurred: false,
      nextPosition: dot.position,
      preservedVelocity: dot.velocity,
    }),
  };
}
