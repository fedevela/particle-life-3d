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
  if (x < min || x > max) {
    wrapOccurred = true;
    if (input.boundaryMode === "bounce-back") {
      x = x < min ? min + (min - x) : max - (x - max);
      x = Math.min(max, Math.max(min, x));
      vx *= -1;
    } else {
      x = Math.min(max, Math.max(min, x));
      vx = 0;
    }
  }

  if (y < min || y > max) {
    wrapOccurred = true;
    if (input.boundaryMode === "bounce-back") {
      y = y < min ? min + (min - y) : max - (y - max);
      y = Math.min(max, Math.max(min, y));
      vy *= -1;
    } else {
      y = Math.min(max, Math.max(min, y));
      vy = 0;
    }
  }

  if (z < min || z > max) {
    wrapOccurred = true;
    if (input.boundaryMode === "bounce-back") {
      z = z < min ? min + (min - z) : max - (z - max);
      z = Math.min(max, Math.max(min, z));
      vz *= -1;
    } else {
      z = Math.min(max, Math.max(min, z));
      vz = 0;
    }
  }

  return {
    wrapOccurred,
    nextPosition: [x, y, z] as const,
    preservedVelocity: [vx, vy, vz] as const,
  };
}
