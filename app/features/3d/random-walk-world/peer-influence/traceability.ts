import type { Issue33RequirementId } from "~/features/3d/random-walk-world/peer-influence/contracts";

export type ArchitecturePressureType =
  | "ownership-boundary"
  | "dependency-direction"
  | "integration-seam"
  | "contract-shape"
  | "structural-placement";

export type RequirementArchitecturePressure = {
  requirementId: Issue33RequirementId;
  pressure: string;
  pressureType: ArchitecturePressureType;
};

export const ISSUE_33_ARCHITECTURE_PRESSURES: readonly RequirementArchitecturePressure[] = [
  {
    requirementId: "CH-004",
    pressure:
      "Frame-stage friction responsibilities need a dedicated seam so decay ownership is isolated from integration and wrapping concerns.",
    pressureType: "ownership-boundary",
  },
  {
    requirementId: "CH-005",
    pressure:
      "Neighbor aggregation requires a typed contract boundary so radius-based peer direction calculation can be implemented without leaking through UI modules.",
    pressureType: "contract-shape",
  },
  {
    requirementId: "CH-005-A",
    pressure:
      "A mode toggle parameter must flow from UI controls into simulation seams to preserve backward-compatible regular random walk behavior.",
    pressureType: "dependency-direction",
  },
  {
    requirementId: "CH-008",
    pressure:
      "Dual-bias impulse composition needs a stable integration seam for velocity-bias and peer-bias inputs before runtime math is added.",
    pressureType: "integration-seam",
  },
] as const;

export type ArchitectureArtifactType =
  | "explicit-contract-type"
  | "structural-placement"
  | "ownership-boundary"
  | "dependency-direction"
  | "integration-seam";

export type Issue33ArchitectureLocus = {
  requirementId: Issue33RequirementId;
  owner: string;
  artifactType: ArchitectureArtifactType;
  plannedFileChange: string;
};

export const ISSUE_33_ARCHITECTURE_LOCI: readonly Issue33ArchitectureLocus[] = [
  {
    requirementId: "CH-004",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.architecture.ts",
    artifactType: "ownership-boundary",
    plannedFileChange: "Define ambient-friction seam contract and no-op plan return shape.",
  },
  {
    requirementId: "CH-005",
    owner: "app/features/3d/random-walk-world/random-walk-peer-influence.architecture.ts",
    artifactType: "explicit-contract-type",
    plannedFileChange: "Define neighbor-average aggregation seam contract and fallback metadata boundary.",
  },
  {
    requirementId: "CH-005-A",
    owner: "app/types/random-walk-world.ts",
    artifactType: "dependency-direction",
    plannedFileChange: "Add physics-mode toggle and typed physics parameters flowing from UI to simulation.",
  },
  {
    requirementId: "CH-008",
    owner: "app/features/3d/random-walk-world/random-walk-world-simulation.ts",
    artifactType: "integration-seam",
    plannedFileChange: "Route dual-bias inputs through architecture port without runtime behavior implementation.",
  },
] as const;

export const ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS = ["CH-004", "CH-005", "CH-005-A", "CH-008"] as const;
