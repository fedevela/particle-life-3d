import { expect, test } from "@playwright/test";

import {
  ISSUE_33_ARCHITECTURE_LOCI,
  ISSUE_33_ARCHITECTURE_PRESSURES,
  ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS,
} from "~/features/3d/random-walk-world/random-walk-peer-influence.architecture";
import { ISSUE_33_RANDOM_WALK_PHYSICS_SEAM } from "~/features/3d/random-walk-world/random-walk-world-physics-seam";
import { ISSUE_33_RANDOM_WALK_ARCH_REQUIREMENTS } from "~/types/random-walk-world";

test.describe("Issue #33 phase 7 architecture traceability", () => {
  test("phase-7 architecture pressure set is non-empty", () => {
    expect(ISSUE_33_ARCHITECTURE_PRESSURES.length).toBeGreaterThan(0);
  });

  test("phase-7 architecture loci set is non-empty", () => {
    expect(ISSUE_33_ARCHITECTURE_LOCI.length).toBeGreaterThan(0);
  });

  test("canonical requirement IDs map to at least one architecture pressure", () => {
    const covered = new Set(ISSUE_33_ARCHITECTURE_PRESSURES.map((entry) => entry.requirementId));

    for (const requirementId of ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS) {
      expect(covered.has(requirementId)).toBe(true);
    }
  });

  test("canonical requirement IDs map to at least one architecture locus", () => {
    const covered = new Set(ISSUE_33_ARCHITECTURE_LOCI.map((entry) => entry.requirementId));

    for (const requirementId of ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS) {
      expect(covered.has(requirementId)).toBe(true);
    }
  });

  test("cross-module architecture requirement declarations remain aligned", () => {
    expect(ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS).toEqual(ISSUE_33_RANDOM_WALK_PHYSICS_SEAM.requirementIds);
    expect(ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS).toEqual(ISSUE_33_RANDOM_WALK_ARCH_REQUIREMENTS);
  });

  for (const requirementId of ISSUE_33_RANDOM_WALK_ARCHITECTURE_REQUIREMENTS) {
    test(`${requirementId} has a planned file-level architecture change`, () => {
      const mappings = ISSUE_33_ARCHITECTURE_LOCI.filter((entry) => entry.requirementId === requirementId);
      expect(mappings.length).toBeGreaterThan(0);

      for (const mapping of mappings) {
        expect(mapping.plannedFileChange.length).toBeGreaterThan(0);
      }
    });
  }
});
