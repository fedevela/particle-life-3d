import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHOULD_UPDATE_CONTRACTS = process.env.UPDATE_RANDOM_WALK_CONTRACTS === "1";
const FIXTURE_SEED = "random-walk-parameter-canonical-v1";
const MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const FIXTURE_DIR = path.join(__dirname, "contracts", "parameter-canonical.small-universe");

type Scenario = {
  name: string;
  apply?: (page: Page) => Promise<void>;
  expectedLine?: string;
};

const SCENARIOS: readonly Scenario[] = [
  { name: "baseline" },
  {
    name: "seed",
    apply: async (page) => {
      await setTextControl(page.locator("#random-walk-world-seed"), "random-walk-parameter-canonical-v2");
    },
  },
  {
    name: "dotCount",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-dotCount"), "128"),
    expectedLine: "dot_count=128",
  },
  {
    name: "stepScale",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-stepScale"), "0.035"),
    expectedLine: "step_scale=0.0350",
  },
  {
    name: "boundaryExtent",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-boundaryExtent"), "0.40"),
    expectedLine: "boundary_extent=0.4000",
  },
  {
    name: "mode",
    apply: async (page) => {
      const modeSelect = page.locator("#random-walk-world-mode");
      await expect(modeSelect).toBeVisible();
      await modeSelect.selectOption("regular-random-walk");
      await expect(modeSelect).toHaveValue("regular-random-walk");
    },
    expectedLine: "mode=regular-random-walk",
  },
  {
    name: "boundaryMode",
    apply: async (page) => {
      const boundaryModeSelect = page.locator("#random-walk-world-boundaryMode");
      await expect(boundaryModeSelect).toBeVisible();
      await boundaryModeSelect.selectOption("bounce-back");
      await expect(boundaryModeSelect).toHaveValue("bounce-back");
    },
    expectedLine: "boundary_mode=bounce-back",
  },
  {
    name: "ambientFriction",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-ambientFriction"), "0.80"),
    expectedLine: "ambient_friction=0.8000",
  },
  {
    name: "peerInfluenceRadius",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-peerInfluenceRadius"), "3.20"),
    expectedLine: "peer_radius=3.2000",
  },
  {
    name: "randomImpulseWeight",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-randomImpulseWeight"), "0.20"),
    expectedLine: "random_impulse=0.2000",
  },
  {
    name: "separationWeight",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-separationWeight"), "2.40"),
    expectedLine: "personal_space_strength=2.4000",
  },
  {
    name: "separationRadius",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-separationRadius"), "1.20"),
    expectedLine: "personal_space_radius=1.2000",
  },
  {
    name: "maxSpeedMultiplier",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-maxSpeedMultiplier"), "6.00"),
    expectedLine: "top_speed_limit=6.0000",
  },
  {
    name: "velocityDampingCurve",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-velocityDampingCurve"), "2.75"),
    expectedLine: "braking_curve=2.7500",
  },
  {
    name: "centerAttraction",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-centerAttraction"), "1.20"),
    expectedLine: "center_pull=1.2000",
  },
  {
    name: "massVariance",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-massVariance"), "0.80"),
    expectedLine: "mass_diversity=0.8000",
  },
  {
    name: "velocityBiasWeight",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-velocityBiasWeight"), "2.20"),
    expectedLine: "keep_direction=2.2000",
  },
  {
    name: "peerBiasWeight",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-peerBiasWeight"), "2.80"),
    expectedLine: "follow_neighbors=2.8000",
  },
  {
    name: "neighborCohesionWeight",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-neighborCohesionWeight"), "2.20"),
    expectedLine: "collapse_pull=2.2000",
  },
  {
    name: "peerImpulseScale",
    apply: async (page) => setNumericControl(page.locator("#random-walk-world-peerImpulseScale"), "2.20"),
    expectedLine: "push_strength=2.2000",
  },
] as const;

const BASELINE_PHYSICS_VALUES: Record<string, string> = {
  ambientFriction: "0.20",
  peerInfluenceRadius: "1.60",
  randomImpulseWeight: "1.00",
  separationWeight: "1.20",
  separationRadius: "0.45",
  maxSpeedMultiplier: "3.00",
  velocityDampingCurve: "1.00",
  centerAttraction: "0.20",
  massVariance: "0.20",
  velocityBiasWeight: "1.00",
  peerBiasWeight: "2.40",
  neighborCohesionWeight: "0.90",
  peerImpulseScale: "1.00",
};

async function waitForRandomWalkContractGlobals(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ === "function",
        hasReset: typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ === "function",
      }));
    }, { timeout: 15_000, intervals: [100, 250, 500] })
    .toEqual({ hasGetContract: true, hasReset: true });
}

async function openRandomWalkWorld(page: Page) {
  await page.goto(`/random-walk-world?testMode=true&seed=${FIXTURE_SEED}&uiInputDebounceMs=0`);
  await waitForRandomWalkContractGlobals(page);

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  if (!(await dotCountInput.isVisible())) {
    await page.getByRole("link", { name: "Swarm Simulator" }).click();
  }

  await expect(dotCountInput).toBeVisible();
  await expect(page.locator("#random-walk-world-stepScale")).toBeVisible();
  await expect(page.locator("#random-walk-world-boundaryExtent")).toBeVisible();
  await expect(page.locator("#random-walk-world-mode")).toBeVisible();
}

async function resetRandomWalkSimulation(page: Page) {
  await page.evaluate(() => {
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }

    window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
  });
}

async function getContractAtTimeMs(page: Page, timeMs: number) {
  return page.evaluate(({ targetTimeMs }) => {
    if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_RANDOM_WALK_CONTRACT_TEXT__(targetTimeMs);
  }, { targetTimeMs: timeMs });
}

function getContractValue(contractText: string, key: string) {
  const line = contractText.split("\n").find((entry) => entry.startsWith(`${key}=`));
  if (!line) {
    throw new Error(`Contract key \"${key}\" is missing.`);
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex === -1) {
    throw new Error(`Contract line for key \"${key}\" is malformed.`);
  }

  return line.slice(separatorIndex + 1);
}

async function setNumericControl(locator: Locator, value: string) {
  await expect(locator).toBeVisible();
  await locator.fill(value);
}

async function setTextControl(locator: Locator, value: string) {
  await expect(locator).toBeVisible();
  await locator.fill(value);
}

async function applySmallUniverseBaseline(page: Page) {
  await setTextControl(page.locator("#random-walk-world-seed"), "");
  await setNumericControl(page.locator("#random-walk-world-dotCount"), "64");
  await setNumericControl(page.locator("#random-walk-world-stepScale"), "0.020");
  await setNumericControl(page.locator("#random-walk-world-boundaryExtent"), "0.25");

  const modeSelect = page.locator("#random-walk-world-mode");
  await modeSelect.selectOption("peer-influenced-random-walk");
  await expect(modeSelect).toHaveValue("peer-influenced-random-walk");

  const boundaryModeSelect = page.locator("#random-walk-world-boundaryMode");
  await boundaryModeSelect.selectOption("wrap-around");
  await expect(boundaryModeSelect).toHaveValue("wrap-around");

  for (const [key, value] of Object.entries(BASELINE_PHYSICS_VALUES)) {
    await setNumericControl(page.locator(`#random-walk-world-${key}`), value);
  }

  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("dot_count=64");
  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("boundary_extent=0.2500");
  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("mode=peer-influenced-random-walk");
}

async function captureMilestoneContracts(page: Page) {
  const contracts = new Map<number, string>();
  for (const milestoneMs of MILESTONES_MS) {
    contracts.set(milestoneMs, (await getContractAtTimeMs(page, milestoneMs)).trimEnd());
  }

  return contracts;
}

function fixturePathForScenario(scenarioName: string, milestoneMs: number) {
  return path.join(
    FIXTURE_DIR,
    scenarioName,
    `random-walk-world.ms-${String(milestoneMs).padStart(3, "0")}.txt`,
  );
}

async function assertOrUpdateScenarioContracts(scenarioName: string, contractsByMilestone: Map<number, string>) {
  for (const milestoneMs of MILESTONES_MS) {
    const contract = contractsByMilestone.get(milestoneMs);
    if (!contract) {
      throw new Error(`Missing canonical contract for ${scenarioName} at ${milestoneMs}ms.`);
    }

    const fixturePath = fixturePathForScenario(scenarioName, milestoneMs);
    if (SHOULD_UPDATE_CONTRACTS) {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${contract}\n`, "utf8");
      continue;
    }

    const expected = (await readFile(fixturePath, "utf8")).trimEnd();
    expect(contract).toBe(expected);
  }
}

test.describe.serial("random-walk-world canonical parameter milestones in small universe", () => {
  for (const scenario of SCENARIOS) {
    test(`captures canonical milestones for ${scenario.name}`, async ({ page }) => {
      await openRandomWalkWorld(page);
      await applySmallUniverseBaseline(page);
      await resetRandomWalkSimulation(page);
      const baselineContracts = await captureMilestoneContracts(page);

      let scenarioContracts = baselineContracts;
      if (scenario.apply) {
        await scenario.apply(page);
        if (scenario.expectedLine) {
          await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain(scenario.expectedLine);
        }

        await resetRandomWalkSimulation(page);
        scenarioContracts = await captureMilestoneContracts(page);

        let checksumDiffMilestones = 0;
        for (const milestoneMs of MILESTONES_MS) {
          const baseline = baselineContracts.get(milestoneMs);
          const variant = scenarioContracts.get(milestoneMs);
          if (!baseline || !variant) {
            throw new Error(`Missing baseline or scenario contract for ${scenario.name} at ${milestoneMs}ms.`);
          }

          if (getContractValue(baseline, "checksum") !== getContractValue(variant, "checksum")) {
            checksumDiffMilestones += 1;
          }
        }

        expect(checksumDiffMilestones).toBeGreaterThan(0);
      }

      await assertOrUpdateScenarioContracts(scenario.name, scenarioContracts);
    });
  }
});
