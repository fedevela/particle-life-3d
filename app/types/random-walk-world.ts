/** Issue #32 architecture contract mapping: CH-001, CH-003. */
export const ISSUE_32_RANDOM_WALK_ARCH_REQUIREMENTS = ["CH-001", "CH-003"] as const;
/** Issue #33 architecture contract mapping: CH-004, CH-005, CH-005-A, CH-008. */
export const ISSUE_33_RANDOM_WALK_ARCH_REQUIREMENTS = ["CH-004", "CH-005", "CH-005-A", "CH-008"] as const;

/** Define the sidebar route label and path for the random-walk surface (CH-001). */
export const RANDOM_WALK_WORLD_ROUTE_PATH = "/random-walk-world";
export const RANDOM_WALK_WORLD_MENU_LABEL = "Random Walk Sphere";

export type RandomWalkWorldParamKey = "dotCount" | "stepScale" | "boundaryExtent";

export type RandomWalkWorldParams = Record<RandomWalkWorldParamKey, number>;

export type RandomWalkWorldParamControl = {
  label: string;
  min: number;
  max: number;
  step: number;
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
    max: 65536,
    step: 64,
    tooltip: "Number of dots participating in the random-walk simulation.",
  },
  stepScale: {
    label: "Step Scale",
    min: 0.001,
    max: 0.1,
    step: 0.001,
    tooltip: "Distance scale applied to each random-walk integration step.",
  },
  boundaryExtent: {
    label: "Boundary Extent",
    min: 0.25,
    max: 10,
    step: 0.05,
    tooltip: "Half-width of the invisible toroidal cube boundary.",
  },
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
    tooltip: "Frame-level decay coefficient applied to velocity before new impulses are integrated.",
  },
  peerInfluenceRadius: {
    label: "Peer Radius",
    min: 0.05,
    max: 10,
    step: 0.05,
    tooltip: "3D distance threshold used for neighbor average-direction influence.",
  },
  velocityBiasWeight: {
    label: "Velocity Bias",
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: "Weight for current velocity direction when deriving dual-bias impulses.",
  },
  peerBiasWeight: {
    label: "Peer Bias",
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: "Weight for peer-average direction when deriving dual-bias impulses.",
  },
  peerImpulseScale: {
    label: "Peer Impulse Scale",
    min: 0,
    max: 1,
    step: 0.01,
    tooltip: "Scale applied to peer-influenced impulse integration each frame.",
  },
};

export const DEFAULT_RANDOM_WALK_WORLD_PHYSICS_PARAMS: RandomWalkWorldPhysicsParams = {
  mode: "regular-random-walk",
  ambientFriction: 0.08,
  peerInfluenceRadius: 1.2,
  velocityBiasWeight: 0.5,
  peerBiasWeight: 0.5,
  peerImpulseScale: 0.15,
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
