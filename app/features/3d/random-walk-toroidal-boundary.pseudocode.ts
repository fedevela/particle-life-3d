export type Issue32RequirementId = "CH-001" | "CH-003";

export type RequirementLogicObligation = {
  id: Issue32RequirementId;
  obligation: string;
  owningPseudocodeLocus: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts";
  requirementCases: readonly string[];
};

export const ISSUE_32_LOGIC_OBLIGATIONS: readonly RequirementLogicObligation[] = [
  {
    id: "CH-001",
    obligation:
      "When the third left menu option is selected, initialize and expose a random-walk dot-cloud scene with label and parameter controls.",
    owningPseudocodeLocus: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts",
    requirementCases: [
      "menu.third-option.selection.initializes-random-walk-dot-cloud-scene",
      "menu.third-option.label.identifies-random-walk-sphere-visualization",
      "menu.third-option.controls.render-parameter-editing-surface",
    ],
  },
  {
    id: "CH-003",
    obligation:
      "When a dot exits a cube boundary on any axis, wrap position to the opposite boundary while preserving velocity continuity.",
    owningPseudocodeLocus: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts",
    requirementCases: [
      "toroidal-boundary.positive-axis.crossing.wraps-to-opposite-side",
      "toroidal-boundary.negative-axis.crossing.wraps-to-opposite-side",
      "toroidal-boundary.wrap-transition.preserves-velocity-vector",
      "toroidal-boundary.wrap-transition.remains-visually-seamless",
    ],
  },
] as const;

export type MenuSelectionFlowInput = {
  selectedMenuOptionIndex: number;
  expectedRandomWalkMenuIndex: number;
  randomWalkMenuLabel: string;
};

export type MenuSelectionFlowState =
  | "idle"
  | "menu-option-validated"
  | "scene-initialized"
  | "controls-exposed";

export type DeriveRandomWalkMenuSelectionFlow = (
  input: MenuSelectionFlowInput,
) => readonly MenuSelectionFlowState[];

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

export type DeriveToroidalWrapTransition = (
  dot: DotKinematics,
  boundary: ToroidalBoundary,
) => ToroidalWrapTransition;

export type Issue32PseudocodeLocus = {
  requirementId: Issue32RequirementId;
  owner: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts";
  pseudocodeArtifacts: readonly string[];
};

export const ISSUE_32_PSEUDOCODE_LOCI: readonly Issue32PseudocodeLocus[] = [
  {
    requirementId: "CH-001",
    owner: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts",
    pseudocodeArtifacts: [
      "DeriveRandomWalkMenuSelectionFlow",
      "MenuSelectionFlowInput",
      "MenuSelectionFlowState",
    ],
  },
  {
    requirementId: "CH-003",
    owner: "app/features/3d/random-walk-toroidal-boundary.pseudocode.ts",
    pseudocodeArtifacts: [
      "DeriveToroidalWrapTransition",
      "DotKinematics",
      "ToroidalBoundary",
      "ToroidalWrapTransition",
    ],
  },
] as const;
