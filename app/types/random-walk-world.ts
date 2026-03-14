/** Define the sidebar route label and path for the random-walk surface (CH-001). */
export const RANDOM_WALK_WORLD_ROUTE_PATH = "/random-walk-world";
export const RANDOM_WALK_WORLD_MENU_LABEL = "Swarm Simulator";
/** Issue #34 ownership seam: CH-002 seed input source for deterministic replay. */
export const RANDOM_WALK_WORLD_SEED_INPUT_ID = "random-walk-world-seed";
export const DEFAULT_RANDOM_WALK_WORLD_SEED_INPUT = "";

export type RandomWalkWorldParamKey = "dotCount" | "stepScale" | "boundaryExtent";

export type RandomWalkWorldParams = Record<RandomWalkWorldParamKey, number>;

export type RandomWalkWorldParamControl = {
  label: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
};

export type RandomWalkWorldSeedControl = {
  label: string;
  placeholder: string;
  tooltip: string;
};

export type RandomWalkPhysicsMode = "regular-random-walk" | "peer-influenced-random-walk";

export type RandomWalkWorldPhysicsParamKey =
  | "ambientFriction"
  | "peerInfluenceRadius"
  | "velocityBiasWeight"
  | "peerBiasWeight"
  | "peerImpulseScale";

export type RandomWalkWorldPhysicsParams = {
  mode: RandomWalkPhysicsMode;
} & Record<RandomWalkWorldPhysicsParamKey, number>;

export type RandomWalkWorldPhysicsParamControl = {
  label: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
};

export const RANDOM_WALK_WORLD_PARAM_ORDER: readonly RandomWalkWorldParamKey[] = [
  "dotCount",
  "stepScale",
  "boundaryExtent",
] as const;

export const RANDOM_WALK_WORLD_PHYSICS_PARAM_ORDER: readonly RandomWalkWorldPhysicsParamKey[] = [
  "ambientFriction",
  "peerInfluenceRadius",
  "velocityBiasWeight",
  "peerBiasWeight",
  "peerImpulseScale",
] as const;

export const RANDOM_WALK_WORLD_PARAM_CONTROLS: Record<RandomWalkWorldParamKey, RandomWalkWorldParamControl> = {
  dotCount: {
    label: "Dot Count",
    min: 64,
    max: 100000,
    step: 64,
    tooltip: "How many dots are moving in the scene.",
  },
  stepScale: {
    label: "Step Scale",
    min: 0.001,
    max: 0.1,
    step: 0.001,
    tooltip: "How far each dot tries to move on every update.",
  },
  boundaryExtent: {
    label: "Boundary Extent",
    min: 0.25,
    max: 25000,
    step: 0.05,
    tooltip: "How far dots can move from center before wrapping to the other side.",
  },
};

export const RANDOM_WALK_WORLD_SEED_CONTROL: RandomWalkWorldSeedControl = {
  label: "Deterministic Seed",
  placeholder: "Leave blank for session fallback",
  tooltip: "Shared seed text reproduces the same movement pattern across runs.",
};

export const DEFAULT_RANDOM_WALK_WORLD_PARAMS: RandomWalkWorldParams = {
  dotCount: 2048,
  stepScale: 0.01,
  boundaryExtent: 2.5,
};

export const RANDOM_WALK_WORLD_PHYSICS_MODE_OPTIONS: readonly RandomWalkPhysicsMode[] = [
  "regular-random-walk",
  "peer-influenced-random-walk",
] as const;

export const RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS: Record<
  RandomWalkWorldPhysicsParamKey,
  RandomWalkWorldPhysicsParamControl
> = {
  ambientFriction: {
    label: "Ambient Friction",
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: "How quickly dots slow down when nothing pushes them.",
  },
  peerInfluenceRadius: {
    label: "Peer Radius",
    min: 0.05,
    max: 50,
    step: 0.05,
    tooltip: "How close other dots must be to count as neighbors.",
  },
  velocityBiasWeight: {
    label: "Keep Direction",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How much a dot prefers continuing in its current direction.",
  },
  peerBiasWeight: {
    label: "Follow Neighbors",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How much a dot wants to move with nearby neighbors.",
  },
  peerImpulseScale: {
    label: "Push Strength",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "Overall strength of movement pushes each update.",
  },
};

export const DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS: RandomWalkWorldPhysicsParams = {
  mode: "regular-random-walk",
  ambientFriction: 0.05,
  peerInfluenceRadius: 2.4,
  velocityBiasWeight: 0.25,
  peerBiasWeight: 1.2,
  peerImpulseScale: 0.45,
};

/** Clamp UI-provided random-walk control values to declared bounds (CH-001 integration seam). */
export function clampRandomWalkWorldParams(params: RandomWalkWorldParams): RandomWalkWorldParams {
  return {
    dotCount: Math.round(
      Math.min(
        RANDOM_WALK_WORLD_PARAM_CONTROLS.dotCount.max,
        Math.max(RANDOM_WALK_WORLD_PARAM_CONTROLS.dotCount.min, params.dotCount),
      ),
    ),
    stepScale: Math.min(
      RANDOM_WALK_WORLD_PARAM_CONTROLS.stepScale.max,
      Math.max(RANDOM_WALK_WORLD_PARAM_CONTROLS.stepScale.min, params.stepScale),
    ),
    boundaryExtent: Math.min(
      RANDOM_WALK_WORLD_PARAM_CONTROLS.boundaryExtent.max,
      Math.max(RANDOM_WALK_WORLD_PARAM_CONTROLS.boundaryExtent.min, params.boundaryExtent),
    ),
  };
}

export function clampRandomWalkWorldPhysicsParams(
  params: RandomWalkWorldPhysicsParams,
): RandomWalkWorldPhysicsParams {
  return {
    mode: RANDOM_WALK_WORLD_PHYSICS_MODE_OPTIONS.includes(params.mode) ? params.mode : "regular-random-walk",
    ambientFriction: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.ambientFriction.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.ambientFriction.min, params.ambientFriction),
    ),
    peerInfluenceRadius: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerInfluenceRadius.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerInfluenceRadius.min, params.peerInfluenceRadius),
    ),
    velocityBiasWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityBiasWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityBiasWeight.min, params.velocityBiasWeight),
    ),
    peerBiasWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerBiasWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerBiasWeight.min, params.peerBiasWeight),
    ),
    peerImpulseScale: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerImpulseScale.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerImpulseScale.min, params.peerImpulseScale),
    ),
  };
}

export type DotKinematics = {
  position: readonly [x: number, y: number, z: number];
  velocity: readonly [vx: number, vy: number, vz: number];
};

export type ToroidalBoundary = {
  min: readonly [x: number, y: number, z: number];
  max: readonly [x: number, y: number, z: number];
};

export type ToroidalWrapTransition = {
  wrapOccurred: boolean;
  nextPosition: readonly [x: number, y: number, z: number];
  preservedVelocity: readonly [vx: number, vy: number, vz: number];
};
