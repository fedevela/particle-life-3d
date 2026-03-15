import type { FrameUpdatePlanInput, FrameUpdatePlanOutput } from "~/features/3d/random-walk-world/peer-influence/contracts";

export { createNeighborSpatialIndex, type NeighborSpatialIndex } from "~/features/3d/random-walk-world/peer-influence/spatial-index";
export {
  deriveNeighborAverageDirectionFromSpatialIndex,
  deriveNeighborAverageDirectionPlan,
  deriveNeighborCohesionDirectionFromSpatialIndex,
  deriveNeighborSeparationDirectionFromSpatialIndex,
} from "~/features/3d/random-walk-world/peer-influence/neighbor-aggregation";
export {
  addScaledVector,
  clampUnitInterval,
  deriveAmbientFrictionDecayPlan,
  deriveDualBiasImpulseDirectionPlan,
  normalizeVector,
  vectorLength,
} from "~/features/3d/random-walk-world/peer-influence/vector-blending";

export function deriveFrameUpdatePlan(input: FrameUpdatePlanInput): FrameUpdatePlanOutput {
  const orderedStages =
    input.mode === "regular-random-walk"
      ? ([
          "resolve-mode",
          "integrate-velocity-and-position",
          "enforce-bounded-stability",
        ] as const)
      : ([
          "resolve-mode",
          "apply-ambient-friction",
          "compute-peer-average-direction",
          "derive-dual-bias-impulse",
          "integrate-velocity-and-position",
          "enforce-bounded-stability",
        ] as const);

  return {
    orderedStages,
    mode: input.mode,
    obligationsSatisfied:
      input.mode === "regular-random-walk"
        ? (["CH-005-A"] as const)
        : (["CH-004", "CH-005", "CH-005-A", "CH-008"] as const),
  };
}
