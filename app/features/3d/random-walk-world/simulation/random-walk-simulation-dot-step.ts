import { type NeighborSpatialIndex } from "~/features/3d/random-walk-world/peer-influence/runtime";
import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import {
  applyRegularRandomWalkImpulse,
  clampVelocityMagnitude,
  composePeerInfluencedVelocity,
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
  const startVelocity: [number, number, number] = [
    input.velocities[offset],
    input.velocities[offset + 1],
    input.velocities[offset + 2],
  ];
  const previousSpeed = Math.hypot(startVelocity[0], startVelocity[1], startVelocity[2]);

  const impulsedVelocity =
    input.mode === "regular-random-walk"
      ? applyRegularRandomWalkImpulse(startVelocity, input.params.stepScale, input.nextSignedRandom)
      : composePeerInfluencedVelocity({
          dotIndex: input.dotIndex,
          position: [input.positions[offset], input.positions[offset + 1], input.positions[offset + 2]],
          velocity: startVelocity,
          normalizedFriction: input.normalizedFriction,
          stepScale: input.params.stepScale,
          massNoise: input.massNoiseByDot[input.dotIndex],
          physicsParams: input.physicsParams,
          neighborSpatialIndex: input.neighborSpatialIndex,
          separationSpatialIndex: input.separationSpatialIndex,
          nextSignedRandom: input.nextSignedRandom,
        });

  const clampedVelocity = clampVelocityMagnitude(impulsedVelocity, input.maxSpeed);

  const transition = applyBoundaryTransition({
    nextPosition: [
      input.positions[offset] + clampedVelocity[0],
      input.positions[offset + 1] + clampedVelocity[1],
      input.positions[offset + 2] + clampedVelocity[2],
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
