/** Issue #32 architecture contract mapping: CH-001, CH-003. */
export const ISSUE_32_RANDOM_WALK_ARCH_REQUIREMENTS = ["CH-001", "CH-003"] as const;

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

export const RANDOM_WALK_WORLD_PARAM_ORDER: readonly RandomWalkWorldParamKey[] = [
  "dotCount",
  "stepScale",
  "boundaryExtent",
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
