import { createRandomWalkToroidalPhysicsPort } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import type { RandomWalkWorldPhysicsParams } from "~/types/random-walk-world";

export type BoundaryTransitionInput = {
  nextPosition: readonly [number, number, number];
  velocity: readonly [number, number, number];
  boundaryExtent: number;
  boundaryMode: RandomWalkWorldPhysicsParams["boundaryMode"];
  physicsPort: ReturnType<typeof createRandomWalkToroidalPhysicsPort>;
};

export function applyBoundaryTransition(input: BoundaryTransitionInput) {
  const boundary = {
    min: [-input.boundaryExtent, -input.boundaryExtent, -input.boundaryExtent] as const,
    max: [input.boundaryExtent, input.boundaryExtent, input.boundaryExtent] as const,
  };

  if (input.boundaryMode === "wrap-around") {
    return input.physicsPort.deriveToroidalWrapTransition(
      {
        position: input.nextPosition,
        velocity: input.velocity,
      },
      boundary,
    );
  }

  let x = input.nextPosition[0];
  let y = input.nextPosition[1];
  let z = input.nextPosition[2];
  let vx = input.velocity[0];
  let vy = input.velocity[1];
  let vz = input.velocity[2];
  let wrapOccurred = false;

  const min = -input.boundaryExtent;
  const max = input.boundaryExtent;
  const axes = [
    { position: x, velocity: vx },
    { position: y, velocity: vy },
    { position: z, velocity: vz },
  ];

  for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 1) {
    const axis = axes[axisIndex];
    if (axis.position < min || axis.position > max) {
      wrapOccurred = true;

      if (input.boundaryMode === "bounce-back") {
        if (axis.position < min) {
          axis.position = min + (min - axis.position);
        } else {
          axis.position = max - (axis.position - max);
        }
        axis.position = Math.min(max, Math.max(min, axis.position));
        axis.velocity *= -1;
      } else {
        axis.position = Math.min(max, Math.max(min, axis.position));
        axis.velocity = 0;
      }
    }
  }

  x = axes[0].position;
  y = axes[1].position;
  z = axes[2].position;
  vx = axes[0].velocity;
  vy = axes[1].velocity;
  vz = axes[2].velocity;

  return {
    wrapOccurred,
    nextPosition: [x, y, z] as const,
    preservedVelocity: [vx, vy, vz] as const,
  };
}
