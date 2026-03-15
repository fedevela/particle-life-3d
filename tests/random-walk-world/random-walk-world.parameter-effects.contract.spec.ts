import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHOULD_UPDATE_CONTRACTS = process.env.UPDATE_RANDOM_WALK_CONTRACTS === "1";
const FIXTURE_SEED = "random-walk-parameter-effects-small-universe-v1";
const MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const FIXTURE_DIR = path.join(__dirname, "contracts", "parameter-effects.small-universe");
const MODE_CONTRAST_FIXTURE_DIR = path.join(__dirname, "contracts", "mode-contrast.small-universe");

type ScenarioDefinition = {
  key: string;
  id: string;
  contractKey: string;
  low: string;
  high: string;
};

const PARAMETER_SCENARIOS: readonly ScenarioDefinition[] = [
  {
    key: "ambientFriction",
    id: "random-walk-world-ambientFriction",
    contractKey: "ambient_friction",
    low: "0.00",
    high: "0.95",
  },
  {
    key: "peerInfluenceRadius",
    id: "random-walk-world-peerInfluenceRadius",
    contractKey: "peer_radius",
    low: "0.05",
    high: "6.00",
  },
  {
    key: "randomImpulseWeight",
    id: "random-walk-world-randomImpulseWeight",
    contractKey: "random_impulse",
    low: "0.00",
    high: "2.50",
  },
  {
    key: "separationWeight",
    id: "random-walk-world-separationWeight",
    contractKey: "personal_space_strength",
    low: "0.00",
    high: "2.50",
  },
  {
    key: "separationRadius",
    id: "random-walk-world-separationRadius",
    contractKey: "personal_space_radius",
    low: "0.01",
    high: "2.40",
  },
  {
    key: "maxSpeedMultiplier",
    id: "random-walk-world-maxSpeedMultiplier",
    contractKey: "top_speed_limit",
    low: "0.25",
    high: "8.00",
  },
  {
    key: "velocityDampingCurve",
    id: "random-walk-world-velocityDampingCurve",
    contractKey: "braking_curve",
    low: "0.25",
    high: "4.00",
  },
  {
    key: "centerAttraction",
    id: "random-walk-world-centerAttraction",
    contractKey: "center_pull",
    low: "0.00",
    high: "2.50",
  },
  {
    key: "massVariance",
    id: "random-walk-world-massVariance",
    contractKey: "mass_diversity",
    low: "0.00",
    high: "0.95",
  },
  {
    key: "velocityBiasWeight",
    id: "random-walk-world-velocityBiasWeight",
    contractKey: "keep_direction",
    low: "0.00",
    high: "3.00",
  },
  {
    key: "peerBiasWeight",
    id: "random-walk-world-peerBiasWeight",
    contractKey: "follow_neighbors",
    low: "0.00",
    high: "3.00",
  },
  {
    key: "neighborCohesionWeight",
    id: "random-walk-world-neighborCohesionWeight",
    contractKey: "collapse_pull",
    low: "0.00",
    high: "3.00",
  },
  {
    key: "peerImpulseScale",
    id: "random-walk-world-peerImpulseScale",
    contractKey: "push_strength",
    low: "0.00",
    high: "2.80",
  },
] as const;

const CONTROLLED_BASELINE_PHYSICS_VALUES: Record<string, string> = {
  ambientFriction: "0.20",
  peerInfluenceRadius: "0.80",
  randomImpulseWeight: "0.00",
  separationWeight: "1.20",
  separationRadius: "0.40",
  maxSpeedMultiplier: "3.00",
  velocityDampingCurve: "1.00",
  centerAttraction: "0.20",
  massVariance: "0.20",
  velocityBiasWeight: "1.00",
  peerBiasWeight: "1.00",
  neighborCohesionWeight: "0.50",
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

function getDynamicSignature(contractText: string) {
  return [
    getContractValue(contractText, "avg_x"),
    getContractValue(contractText, "avg_y"),
    getContractValue(contractText, "avg_z"),
    getContractValue(contractText, "avg_speed"),
    getContractValue(contractText, "max_radius"),
    getContractValue(contractText, "sample_0"),
    getContractValue(contractText, "sample_1"),
    getContractValue(contractText, "sample_2"),
  ].join("|");
}

function fixturePathForScenario(scenarioKey: string, variant: "low" | "high", milestoneMs: number) {
  return path.join(
    FIXTURE_DIR,
    scenarioKey,
    `random-walk-world.parameter-effects.${scenarioKey}.${variant}.ms-${String(milestoneMs).padStart(3, "0")}.txt`,
  );
}

async function setNumericControl(locator: Locator, value: string) {
  await expect(locator).toBeVisible();
  await locator.fill(value);
}

function fixturePathForModeContrast(mode: "regular" | "peer", milestoneMs: number) {
  return path.join(
    MODE_CONTRAST_FIXTURE_DIR,
    `random-walk-world.mode-contrast.${mode}.ms-${String(milestoneMs).padStart(3, "0")}.txt`,
  );
}

async function applySmallUniverseBaseline(
  page: Page,
  baselinePhysicsValues: Record<string, string>,
) {
  await setNumericControl(page.locator("#random-walk-world-dotCount"), "64");
  await setNumericControl(page.locator("#random-walk-world-stepScale"), "0.020");
  await setNumericControl(page.locator("#random-walk-world-boundaryExtent"), "0.25");

  const modeSelect = page.locator("#random-walk-world-mode");
  await modeSelect.selectOption("peer-influenced-random-walk");
  await expect(modeSelect).toHaveValue("peer-influenced-random-walk");

  const boundaryModeSelect = page.locator("#random-walk-world-boundaryMode");
  await boundaryModeSelect.selectOption("wrap-around");
  await expect(boundaryModeSelect).toHaveValue("wrap-around");

  for (const scenario of PARAMETER_SCENARIOS) {
    await setNumericControl(page.locator(`#${scenario.id}`), baselinePhysicsValues[scenario.key]);
  }

  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("dot_count=64");
  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("boundary_extent=0.2500");
}

async function captureScenarioContracts(
  page: Page,
  scenario: ScenarioDefinition,
  variant: "low" | "high",
): Promise<Map<number, string>> {
  const scenarioBaselinePhysicsValues =
    scenario.key === "randomImpulseWeight"
      ? {
          ...CONTROLLED_BASELINE_PHYSICS_VALUES,
          randomImpulseWeight: "1.00",
        }
      : CONTROLLED_BASELINE_PHYSICS_VALUES;
  const variantValue = variant === "low" ? scenario.low : scenario.high;
  const contracts = new Map<number, string>();

  await applySmallUniverseBaseline(page, scenarioBaselinePhysicsValues);
  await setNumericControl(page.locator(`#${scenario.id}`), variantValue);

  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain(
    `${scenario.contractKey}=${Number.parseFloat(variantValue).toFixed(4)}`,
  );
  if (scenario.key !== "randomImpulseWeight") {
    await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("random_impulse=0.0000");
  }

  await resetRandomWalkSimulation(page);

  for (const milestoneMs of MILESTONES_MS) {
    contracts.set(milestoneMs, (await getContractAtTimeMs(page, milestoneMs)).trimEnd());
  }

  return contracts;
}

async function assertOrUpdateScenarioContracts(
  scenario: ScenarioDefinition,
  variant: "low" | "high",
  contractsByMilestone: Map<number, string>,
) {
  for (const milestoneMs of MILESTONES_MS) {
    const contract = contractsByMilestone.get(milestoneMs);
    if (!contract) {
      throw new Error(`Missing captured contract for ${scenario.key} ${variant} at ${milestoneMs}ms.`);
    }

    const fixturePath = fixturePathForScenario(scenario.key, variant, milestoneMs);
    if (SHOULD_UPDATE_CONTRACTS) {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${contract}\n`, "utf8");
      continue;
    }

    const expected = (await readFile(fixturePath, "utf8")).trimEnd();
    expect(contract).toBe(expected);
  }
}

test.describe.serial("random-walk-world parameter effects in small universe", () => {
  for (const scenario of PARAMETER_SCENARIOS) {
    test(`captures ${scenario.key} independently at 0..360ms`, async ({ page }) => {
      const testPage = page;
      await openRandomWalkWorld(testPage);
      const lowContracts = await captureScenarioContracts(testPage, scenario, "low");
      const highContracts = await captureScenarioContracts(testPage, scenario, "high");

      let dynamicDiffMilestones = 0;
      for (const milestoneMs of MILESTONES_MS) {
        const lowContract = lowContracts.get(milestoneMs);
        const highContract = highContracts.get(milestoneMs);

        if (!lowContract || !highContract) {
          throw new Error(`Missing low/high contract for ${scenario.key} at ${milestoneMs}ms.`);
        }

        const lowChecksum = getContractValue(lowContract, "checksum");
        const highChecksum = getContractValue(highContract, "checksum");
        expect(lowChecksum).not.toBe(highChecksum);

        if (milestoneMs > 0 && getDynamicSignature(lowContract) !== getDynamicSignature(highContract)) {
          dynamicDiffMilestones += 1;
        }
      }

      expect(dynamicDiffMilestones).toBeGreaterThan(0);
      await assertOrUpdateScenarioContracts(scenario, "low", lowContracts);
      await assertOrUpdateScenarioContracts(scenario, "high", highContracts);
    });
  }
});

async function captureModeContracts(
  page: Page,
  mode: "regular-random-walk" | "peer-influenced-random-walk",
): Promise<Map<number, string>> {
  const contracts = new Map<number, string>();
  await setNumericControl(page.locator("#random-walk-world-dotCount"), "64");
  await setNumericControl(page.locator("#random-walk-world-stepScale"), "0.020");
  await setNumericControl(page.locator("#random-walk-world-boundaryExtent"), "0.25");

  const boundaryModeSelect = page.locator("#random-walk-world-boundaryMode");
  await boundaryModeSelect.selectOption("wrap-around");
  await expect(boundaryModeSelect).toHaveValue("wrap-around");

  const modeSelect = page.locator("#random-walk-world-mode");
  await modeSelect.selectOption(mode);
  await expect(modeSelect).toHaveValue(mode);

  if (mode === "peer-influenced-random-walk") {
    await setNumericControl(page.locator("#random-walk-world-randomImpulseWeight"), "0.00");
    await setNumericControl(page.locator("#random-walk-world-ambientFriction"), "0.20");
    await setNumericControl(page.locator("#random-walk-world-peerInfluenceRadius"), "1.60");
    await setNumericControl(page.locator("#random-walk-world-velocityBiasWeight"), "1.00");
    await setNumericControl(page.locator("#random-walk-world-peerBiasWeight"), "2.40");
    await setNumericControl(page.locator("#random-walk-world-neighborCohesionWeight"), "0.90");
    await setNumericControl(page.locator("#random-walk-world-separationWeight"), "1.20");
    await setNumericControl(page.locator("#random-walk-world-separationRadius"), "0.45");
    await setNumericControl(page.locator("#random-walk-world-peerImpulseScale"), "1.00");
    await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("random_impulse=0.0000");
  }

  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("dot_count=64");
  await expect.poll(async () => getContractAtTimeMs(page, 0)).toContain("boundary_extent=0.2500");
  await resetRandomWalkSimulation(page);

  for (const milestoneMs of MILESTONES_MS) {
    contracts.set(milestoneMs, (await getContractAtTimeMs(page, milestoneMs)).trimEnd());
  }

  return contracts;
}

async function assertOrUpdateModeContracts(mode: "regular" | "peer", contractsByMilestone: Map<number, string>) {
  for (const milestoneMs of MILESTONES_MS) {
    const contract = contractsByMilestone.get(milestoneMs);
    if (!contract) {
      throw new Error(`Missing mode-contrast contract for ${mode} at ${milestoneMs}ms.`);
    }

    const fixturePath = fixturePathForModeContrast(mode, milestoneMs);
    if (SHOULD_UPDATE_CONTRACTS) {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${contract}\n`, "utf8");
      continue;
    }

    const expected = (await readFile(fixturePath, "utf8")).trimEnd();
    expect(contract).toBe(expected);
  }
}

test.describe.serial("random-walk-world mode contrast in small universe", () => {
  test("captures canonical milestones for regular vs peer mode at matching ms", async ({ page }) => {
    await openRandomWalkWorld(page);

    const regularContracts = await captureModeContracts(page, "regular-random-walk");
    const peerContracts = await captureModeContracts(page, "peer-influenced-random-walk");

    let dynamicDiffMilestones = 0;
    for (const milestoneMs of MILESTONES_MS) {
      const regularContract = regularContracts.get(milestoneMs);
      const peerContract = peerContracts.get(milestoneMs);
      if (!regularContract || !peerContract) {
        throw new Error(`Missing regular/peer contract at ${milestoneMs}ms.`);
      }

      const regularSignature = getDynamicSignature(regularContract);
      const peerSignature = getDynamicSignature(peerContract);
      if (regularSignature !== peerSignature) {
        dynamicDiffMilestones += 1;
      }
    }

    expect(dynamicDiffMilestones).toBeGreaterThan(0);
    await assertOrUpdateModeContracts("regular", regularContracts);
    await assertOrUpdateModeContracts("peer", peerContracts);
  });
});
