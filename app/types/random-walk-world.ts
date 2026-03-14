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
export type RandomWalkBoundaryMode = "wrap-around" | "bounce-back" | "edge-trap";

export type RandomWalkWorldPhysicsParamKey =
  | "ambientFriction"
  | "peerInfluenceRadius"
  | "randomImpulseWeight"
  | "separationWeight"
  | "separationRadius"
  | "maxSpeedMultiplier"
  | "velocityDampingCurve"
  | "neighborCountCap"
  | "centerAttraction"
  | "massVariance"
  | "velocityBiasWeight"
  | "peerBiasWeight"
  | "neighborCohesionWeight"
  | "peerImpulseScale";

export type RandomWalkWorldPhysicsParams = {
  mode: RandomWalkPhysicsMode;
  boundaryMode: RandomWalkBoundaryMode;
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
  "randomImpulseWeight",
  "separationWeight",
  "separationRadius",
  "maxSpeedMultiplier",
  "velocityDampingCurve",
  "neighborCountCap",
  "centerAttraction",
  "massVariance",
  "velocityBiasWeight",
  "peerBiasWeight",
  "neighborCohesionWeight",
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
export const RANDOM_WALK_WORLD_BOUNDARY_MODE_OPTIONS: readonly RandomWalkBoundaryMode[] = [
  "wrap-around",
  "bounce-back",
  "edge-trap",
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
  randomImpulseWeight: {
    label: "Wander Energy",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How much unpredictable motion each dot keeps.",
  },
  separationWeight: {
    label: "Personal Space Strength",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How strongly nearby dots push each other away at close range.",
  },
  separationRadius: {
    label: "Personal Space Radius",
    min: 0.01,
    max: 25,
    step: 0.01,
    tooltip: "How close dots can get before they start pushing apart.",
  },
  maxSpeedMultiplier: {
    label: "Top Speed Limit",
    min: 0.25,
    max: 12,
    step: 0.01,
    tooltip: "Hard cap for movement speed, scaled by Step Scale.",
  },
  velocityDampingCurve: {
    label: "Braking Curve",
    min: 0.25,
    max: 4,
    step: 0.01,
    tooltip: "How sharply friction slows motion over time.",
  },
  neighborCountCap: {
    label: "Neighbor Attention",
    min: 1,
    max: 256,
    step: 1,
    tooltip: "Maximum nearby dots each dot reacts to per frame.",
  },
  centerAttraction: {
    label: "Center Pull",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How strongly dots are drawn toward the scene center.",
  },
  massVariance: {
    label: "Mass Diversity",
    min: 0,
    max: 0.95,
    step: 0.01,
    tooltip: "How much heavier and lighter dots differ from each other.",
  },
  velocityBiasWeight: {
    label: "Momentum Memory",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How much a dot prefers continuing in its current direction.",
  },
  peerBiasWeight: {
    label: "Group Alignment",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How much a dot wants to move with nearby neighbors.",
  },
  neighborCohesionWeight: {
    label: "Collapse Pull",
    min: 0,
    max: 3,
    step: 0.01,
    tooltip: "How strongly dots pull toward nearby neighbors to form tighter clumps.",
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
  boundaryMode: "wrap-around",
  ambientFriction: 0.05,
  peerInfluenceRadius: 2.4,
  randomImpulseWeight: 1,
  separationWeight: 0.8,
  separationRadius: 0.7,
  maxSpeedMultiplier: 3,
  velocityDampingCurve: 1,
  neighborCountCap: 64,
  centerAttraction: 0,
  massVariance: 0,
  velocityBiasWeight: 0.25,
  peerBiasWeight: 1.2,
  neighborCohesionWeight: 0,
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
    boundaryMode: RANDOM_WALK_WORLD_BOUNDARY_MODE_OPTIONS.includes(params.boundaryMode)
      ? params.boundaryMode
      : "wrap-around",
    ambientFriction: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.ambientFriction.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.ambientFriction.min, params.ambientFriction),
    ),
    peerInfluenceRadius: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerInfluenceRadius.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerInfluenceRadius.min, params.peerInfluenceRadius),
    ),
    randomImpulseWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.randomImpulseWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.randomImpulseWeight.min, params.randomImpulseWeight),
    ),
    separationWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.separationWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.separationWeight.min, params.separationWeight),
    ),
    separationRadius: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.separationRadius.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.separationRadius.min, params.separationRadius),
    ),
    maxSpeedMultiplier: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.maxSpeedMultiplier.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.maxSpeedMultiplier.min, params.maxSpeedMultiplier),
    ),
    velocityDampingCurve: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityDampingCurve.max,
      Math.max(
        RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityDampingCurve.min,
        params.velocityDampingCurve,
      ),
    ),
    neighborCountCap: Math.round(
      Math.min(
        RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.neighborCountCap.max,
        Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.neighborCountCap.min, params.neighborCountCap),
      ),
    ),
    centerAttraction: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.centerAttraction.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.centerAttraction.min, params.centerAttraction),
    ),
    massVariance: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.massVariance.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.massVariance.min, params.massVariance),
    ),
    velocityBiasWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityBiasWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.velocityBiasWeight.min, params.velocityBiasWeight),
    ),
    peerBiasWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerBiasWeight.max,
      Math.max(RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.peerBiasWeight.min, params.peerBiasWeight),
    ),
    neighborCohesionWeight: Math.min(
      RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.neighborCohesionWeight.max,
      Math.max(
        RANDOM_WALK_WORLD_PHYSICS_PARAM_CONTROLS.neighborCohesionWeight.min,
        params.neighborCohesionWeight,
      ),
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
