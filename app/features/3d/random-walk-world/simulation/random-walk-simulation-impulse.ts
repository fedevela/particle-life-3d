import {
  deriveAmbientFrictionDecayPlan,
  deriveDualBiasImpulseDirectionPlan,
  deriveNeighborAverageDirectionFromSpatialIndex,
  deriveNeighborCohesionDirectionFromSpatialIndex,
  deriveNeighborSeparationDirectionFromSpatialIndex,
  type NeighborSpatialIndex,
} from "~/features/3d/random-walk-world/peer-influence/runtime";
import { hashSeed } from "~/features/3d/random-walk-world/simulation/random-walk-simulation-rng";
import type { RandomWalkWorldPhysicsParams } from "~/types/random-walk-world";

const REGULAR_IMPULSE_SCALE_FACTOR = 0.15;
const MASS_VARIANCE_MAX = 0.95;

export function normalizeDirection(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 1e-6) {
    return [0, 0, 0];
  }

  return [x / length, y / length, z / length];
}

export function hashIndexNoise(seed: string, dotIndex: number) {
  let hash = hashSeed(seed) ^ Math.imul(dotIndex + 1, 2654435761);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967295;
}

export function deriveMassFactorFromNoise(massNoise: number, massVariance: number) {
  const normalizedVariance = Math.min(MASS_VARIANCE_MAX, Math.max(0, massVariance));
  if (normalizedVariance <= 0) {
    return 1;
  }

  const centeredNoise = massNoise * 2 - 1;
  return Math.max(0.05, 1 + centeredNoise * normalizedVariance);
}

export function applyRegularRandomWalkImpulse(
  velocity: readonly [number, number, number],
  stepScale: number,
  nextSignedRandom: () => number,
): [number, number, number] {
  return [
    velocity[0] + nextSignedRandom() * stepScale * REGULAR_IMPULSE_SCALE_FACTOR,
    velocity[1] + nextSignedRandom() * stepScale * REGULAR_IMPULSE_SCALE_FACTOR,
    velocity[2] + nextSignedRandom() * stepScale * REGULAR_IMPULSE_SCALE_FACTOR,
  ];
}

type PeerImpulseInput = {
  dotIndex: number;
  position: readonly [number, number, number];
  velocity: readonly [number, number, number];
  normalizedFriction: number;
  stepScale: number;
  massNoise: number;
  physicsParams: RandomWalkWorldPhysicsParams;
  neighborSpatialIndex: NeighborSpatialIndex | null;
  separationSpatialIndex: NeighborSpatialIndex | null;
  nextSignedRandom: () => number;
};

export function composePeerInfluencedVelocity(input: PeerImpulseInput): [number, number, number] {
  const friction = deriveAmbientFrictionDecayPlan({
    velocity: input.velocity,
    frictionFactor: input.normalizedFriction,
    dampingCurve: input.physicsParams.velocityDampingCurve,
  });
  let vx = friction.decayedVelocity[0];
  let vy = friction.decayedVelocity[1];
  let vz = friction.decayedVelocity[2];

  const velocityDirection = normalizeDirection(vx, vy, vz);
  const neighborAggregate = deriveNeighborAverageDirectionFromSpatialIndex(
    input.dotIndex,
    input.neighborSpatialIndex,
    input.physicsParams.neighborCountCap,
  );
  const neighborCohesionDirection = deriveNeighborCohesionDirectionFromSpatialIndex(
    input.dotIndex,
    input.neighborSpatialIndex,
    input.physicsParams.neighborCountCap,
  );
  const neighborSeparationDirection = deriveNeighborSeparationDirectionFromSpatialIndex(
    input.dotIndex,
    input.separationSpatialIndex,
    input.physicsParams.neighborCountCap,
  );
  const centerAttractionDirection = normalizeDirection(-input.position[0], -input.position[1], -input.position[2]);
  const randomDirection = normalizeDirection(input.nextSignedRandom(), input.nextSignedRandom(), input.nextSignedRandom());

  const impulseDirection = deriveDualBiasImpulseDirectionPlan({
    randomUnitDirection: randomDirection,
    currentVelocityDirection: velocityDirection,
    peerAverageDirection: neighborAggregate.averageDirection,
    peerCohesionDirection: neighborCohesionDirection,
    peerSeparationDirection: neighborSeparationDirection,
    centerAttractionDirection,
    randomImpulseWeight: input.physicsParams.randomImpulseWeight,
    velocityBiasWeight: input.physicsParams.velocityBiasWeight,
    peerBiasWeight: input.physicsParams.peerBiasWeight,
    peerCohesionWeight: input.physicsParams.neighborCohesionWeight,
    peerSeparationWeight: input.physicsParams.separationWeight,
    centerAttractionWeight: input.physicsParams.centerAttraction,
  });

  const massFactor = deriveMassFactorFromNoise(input.massNoise, input.physicsParams.massVariance);
  const impulseScale = (input.stepScale * input.physicsParams.peerImpulseScale) / massFactor;

  vx += impulseDirection.biasedDirection[0] * impulseScale;
  vy += impulseDirection.biasedDirection[1] * impulseScale;
  vz += impulseDirection.biasedDirection[2] * impulseScale;

  return [vx, vy, vz];
}

export function clampVelocityMagnitude(
  velocity: readonly [number, number, number],
  maxSpeed: number,
): [number, number, number] {
  let [vx, vy, vz] = velocity;
  const speed = Math.hypot(vx, vy, vz);
  if (speed > maxSpeed && speed > 0) {
    const ratio = maxSpeed / speed;
    vx *= ratio;
    vy *= ratio;
    vz *= ratio;
  }

  return [vx, vy, vz];
}
