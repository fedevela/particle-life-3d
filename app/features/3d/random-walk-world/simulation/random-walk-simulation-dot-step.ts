import { type NeighborSpatialIndex } from "~/features/3d/random-walk-world/peer-influence/runtime";
import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  applyRegularRandomWalkImpulseComponents,
  clampVelocityMagnitudeComponents,
  composePeerInfluencedVelocityComponents,
} from "~/features/3d/random-walk-world/simulation/random-walk-simulation-impulse";
import { applyBoundaryTransition } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-boundary";
import type {
  RandomWalkWorldPhysicsParams,
  RandomWalkWorldParams,
} from "~/types/random-walk-world";

type DotStepInput = {
  dotIndex: number;
  params: RandomWalkWorldParams;
  physicsParams: RandomWalkWorldPhysicsParams;
  mode: RandomWalkWorldPhysicsParams["mode"];
  normalizedFriction: number;
  maxSpeed: number;
  positions: Float32Array;
  velocities: Float32Array;
  massNoiseByDot: Float32Array;
  neighborSpatialIndex: NeighborSpatialIndex | null;
  separationSpatialIndex: NeighborSpatialIndex | null;
  physicsPort: ReturnType<typeof createRandomWalkToroidalPhysicsPort>;
  nextSignedRandom: () => number;
};

type DotStepResult = {
  wrapOccurred: boolean;
  previousSpeed: number;
  nextSpeed: number;
};

export function integrateDotStep(input: DotStepInput): DotStepResult {
  const offset = input.dotIndex * 3;
  const positionX = input.positions[offset];
  const positionY = input.positions[offset + 1];
  const positionZ = input.positions[offset + 2];
  const velocityX = input.velocities[offset];
  const velocityY = input.velocities[offset + 1];
  const velocityZ = input.velocities[offset + 2];
  const previousSpeed = Math.hypot(velocityX, velocityY, velocityZ);

  const impulsedVelocity =
    input.mode === "regular-random-walk"
      ? applyRegularRandomWalkImpulseComponents(
          velocityX,
          velocityY,
          velocityZ,
          input.params.stepScale,
          input.nextSignedRandom,
        )
      : composePeerInfluencedVelocityComponents({
          dotIndex: input.dotIndex,
          positionX,
          positionY,
          positionZ,
          velocityX,
          velocityY,
          velocityZ,
          normalizedFriction: input.normalizedFriction,
          stepScale: input.params.stepScale,
          massNoise: input.massNoiseByDot[input.dotIndex],
          physicsParams: input.physicsParams,
          neighborSpatialIndex: input.neighborSpatialIndex,
          separationSpatialIndex: input.separationSpatialIndex,
          nextSignedRandom: input.nextSignedRandom,
        });

  const clampedVelocity = clampVelocityMagnitudeComponents(
    impulsedVelocity[0],
    impulsedVelocity[1],
    impulsedVelocity[2],
    input.maxSpeed,
  );

  const transition = applyBoundaryTransition({
    nextPosition: [
      positionX + clampedVelocity[0],
      positionY + clampedVelocity[1],
      positionZ + clampedVelocity[2],
    ],
    velocity: clampedVelocity,
    boundaryExtent: input.params.boundaryExtent,
    boundaryMode: input.physicsParams.boundaryMode,
    physicsPort: input.physicsPort,
  });

  input.positions[offset] = transition.nextPosition[0];
  input.positions[offset + 1] = transition.nextPosition[1];
  input.positions[offset + 2] = transition.nextPosition[2];
  input.velocities[offset] = transition.preservedVelocity[0];
  input.velocities[offset + 1] = transition.preservedVelocity[1];
  input.velocities[offset + 2] = transition.preservedVelocity[2];

  return {
    wrapOccurred: transition.wrapOccurred,
    previousSpeed,
    nextSpeed: Math.hypot(
      transition.preservedVelocity[0],
      transition.preservedVelocity[1],
      transition.preservedVelocity[2],
    ),
  };
}
