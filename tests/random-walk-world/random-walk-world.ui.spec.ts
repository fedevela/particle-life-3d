import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";

import { createRandomWalkToroidalPhysicsPort } from "../../app/features/3d/random-walk-world/random-walk-world-physics-seam";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.join(__dirname, "contracts");
const CONTRACT_MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const SHOULD_UPDATE_CONTRACTS = process.env.UPDATE_RANDOM_WALK_CONTRACTS === "1";

async function waitForRandomWalkTestGlobals(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ === "function",
        hasReset: typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ === "function",
      }));
    }, { timeout: 15_000, intervals: [100, 250, 500] })
    .toEqual({ hasGetContract: true, hasReset: true });
}

async function waitForRandomWalkCameraGlobal(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => typeof window.__GET_RANDOM_WALK_CAMERA_STATE__ === "function");
    }, { timeout: 15_000, intervals: [100, 250, 500] })
    .toBe(true);
}

async function fetchRandomWalkContractAtMilestoneMs(page: Page, timeMs = 0) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(async ({ targetTimeMs }: { targetTimeMs: number }) => {
        if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
          throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
        }

        return window.__GET_RANDOM_WALK_CONTRACT_TEXT__(targetTimeMs);
      }, { targetTimeMs: timeMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isContextReset = message.includes("Execution context was destroyed");
      const isApiUnavailable = message.includes("__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available");
      if ((!isContextReset && !isApiUnavailable) || attempt === 2) {
        throw error;
      }
      if (isApiUnavailable) {
        await waitForRandomWalkTestGlobals(page);
      }
      await page.waitForTimeout(100);
    }
  }

  throw new Error("Failed to read random walk contract text after retries.");
}

async function resetRandomWalkSimulationForScenario(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }
    await window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
  });
}

async function fetchRandomWalkCameraState(page: Page) {
  return page.evaluate(() => {
    if (typeof window.__GET_RANDOM_WALK_CAMERA_STATE__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CAMERA_STATE__ is not available.");
    }

    return window.__GET_RANDOM_WALK_CAMERA_STATE__();
  });
}

function parseContractMetric(contractText: string, key: string) {
  const line = contractText
    .split("\n")
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) {
    throw new Error(`Contract key "${key}" is missing.`);
  }

  const [, rawValue] = line.split("=");
  return Number.parseFloat(rawValue);
}

function parseCameraDistance(cameraState: { position: readonly [number, number, number]; target: readonly [number, number, number] }) {
  const dx = cameraState.position[0] - cameraState.target[0];
  const dy = cameraState.position[1] - cameraState.target[1];
  const dz = cameraState.position[2] - cameraState.target[2];
  return Math.hypot(dx, dy, dz);
}

function parseContractFrame(contractText: string) {
  return parseContractMetric(contractText, "frame");
}

async function wheelInput(input: Locator, deltaY: number) {
  await input.dispatchEvent("wheel", { deltaY });
}

function getScenarioContractPath(scenario: string, timeMs: number) {
  return path.join(
    CONTRACTS_DIR,
    scenario,
    `random-walk-world.ms-${String(timeMs).padStart(3, "0")}.txt`,
  );
}

async function assertScenarioContracts(page: Page, scenario: string) {
  if (SHOULD_UPDATE_CONTRACTS) {
    const capturedContracts: Array<{ milestoneMs: number; actual: string }> = [];
    for (const milestoneMs of CONTRACT_MILESTONES_MS) {
      const actual = (await fetchRandomWalkContractAtMilestoneMs(page, milestoneMs)).trimEnd();
      capturedContracts.push({ milestoneMs, actual });
    }

    for (const { milestoneMs, actual } of capturedContracts) {
      const fixturePath = getScenarioContractPath(scenario, milestoneMs);
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${actual}\n`, "utf8");
    }
    return;
  }

  for (const milestoneMs of CONTRACT_MILESTONES_MS) {
    const actual = (await fetchRandomWalkContractAtMilestoneMs(page, milestoneMs)).trimEnd();
    const fixturePath = getScenarioContractPath(scenario, milestoneMs);
    const expected = (await readFile(fixturePath, "utf8")).trimEnd();
    expect(actual).toBe(expected);
  }
}

async function openRandomWalkControls(page: Page, seed: string, options?: { uiInputDebounceMs?: number }) {
  const query = new URLSearchParams({
    testMode: "true",
    seed,
  });
  if (typeof options?.uiInputDebounceMs === "number") {
    query.set("uiInputDebounceMs", String(Math.max(0, Math.floor(options.uiInputDebounceMs))));
  }

  await page.goto(`/random-walk-world?${query.toString()}`);
  await waitForRandomWalkTestGlobals(page);

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  if (!(await dotCountInput.isVisible())) {
    const randomWalkLink = page.getByRole("link", { name: "Swarm Simulator" });
    await randomWalkLink.click();
  }

  await expect(page).toHaveURL(/\/random-walk-world(?:\?.*)?$/);
  await expect(page.locator("#random-walk-world-dotCount")).toBeVisible();
  await expect(page.locator("#random-walk-world-stepScale")).toBeVisible();
  await expect(page.locator("#random-walk-world-boundaryExtent")).toBeVisible();
  await waitForRandomWalkCameraGlobal(page);
}

test("menu link opens random-walk scene and controls", async ({ page }) => {
  await page.goto("/");

  const links = page.locator("aside nav a");
  await expect(links).toHaveCount(3);
  await expect(links.nth(2)).toContainText("Swarm Simulator");

  await links.nth(2).click();
  await expect(page).toHaveURL(/\/random-walk-world$/);

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#random-walk-world-dotCount")).toBeVisible();
  await expect(page.locator("#random-walk-world-stepScale")).toBeVisible();
  await expect(page.locator("#random-walk-world-boundaryExtent")).toBeVisible();
});

test("dot count input updates and clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-dot-count-controls");
  const dotCountInput = page.locator("#random-walk-world-dotCount");

  await dotCountInput.fill("4096");
  await expect(dotCountInput).toHaveValue("4096");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("dot_count=4096");

  await dotCountInput.fill("1");
  await expect(dotCountInput).toHaveValue("64");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("dot_count=64");

  await dotCountInput.fill("999999");
  await expect(dotCountInput).toHaveValue("100000");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("dot_count=100000");
  await assertScenarioContracts(page, "random-walk-world.ui-dot-count-clamp");
});

test("step scale input updates and clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-step-scale-controls");
  const stepScaleInput = page.locator("#random-walk-world-stepScale");

  await stepScaleInput.fill("0.023");
  await expect(stepScaleInput).toHaveValue("0.023");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("step_scale=0.0230");

  await stepScaleInput.fill("0");
  await expect(stepScaleInput).toHaveValue("0.001");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("step_scale=0.0010");

  await stepScaleInput.fill("0.999");
  await expect(stepScaleInput).toHaveValue("0.100");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("step_scale=0.1000");
  await assertScenarioContracts(page, "random-walk-world.ui-step-scale-clamp");
});

test("boundary extent input updates and clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-boundary-controls");
  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");

  await boundaryExtentInput.fill("4.75");
  await expect(boundaryExtentInput).toHaveValue("4.75");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_extent=4.7500");

  await boundaryExtentInput.fill("0");
  await expect(boundaryExtentInput).toHaveValue("0.25");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_extent=0.2500");

  await boundaryExtentInput.fill("99999");
  await expect(boundaryExtentInput).toHaveValue("25000.00");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_extent=25000.0000");
  await assertScenarioContracts(page, "random-walk-world.ui-boundary-extent-clamp");
});

test("wheel increments and decrements all controls", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-wheel-controls");

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  await wheelInput(dotCountInput, -120);
  await expect(dotCountInput).toHaveValue("2112");
  await wheelInput(dotCountInput, 120);
  await expect(dotCountInput).toHaveValue("2048");

  const stepScaleInput = page.locator("#random-walk-world-stepScale");
  await wheelInput(stepScaleInput, -120);
  await expect(stepScaleInput).toHaveValue("0.022");
  await wheelInput(stepScaleInput, 120);
  await expect(stepScaleInput).toHaveValue("0.021");

  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");
  await wheelInput(boundaryExtentInput, -120);
  await expect(boundaryExtentInput).toHaveValue("10.05");
  await wheelInput(boundaryExtentInput, 120);
  await expect(boundaryExtentInput).toHaveValue("10.00");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_extent=10.0000");
  await assertScenarioContracts(page, "random-walk-world.ui-wheel-cycle");
});

test("wheel respects min and max clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-wheel-clamp-controls");

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  await dotCountInput.fill("100000");
  await wheelInput(dotCountInput, -120);
  await expect(dotCountInput).toHaveValue("100000");

  const stepScaleInput = page.locator("#random-walk-world-stepScale");
  await stepScaleInput.fill("0.001");
  await wheelInput(stepScaleInput, 120);
  await expect(stepScaleInput).toHaveValue("0.001");

  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");
  await boundaryExtentInput.fill("25000");
  await wheelInput(boundaryExtentInput, -120);
  await expect(boundaryExtentInput).toHaveValue("25000.00");
  await assertScenarioContracts(page, "random-walk-world.ui-wheel-clamp");
});

test("peer influence controls are toggle-gated and expose impulse and collapse controls", async ({ page }) => {
  test.setTimeout(20_000);
  await openRandomWalkControls(page, "random-walk-peer-controls-toggle");

  const modeSelect = page.locator("#random-walk-world-mode");
  const boundaryModeSelect = page.locator("#random-walk-world-boundaryMode");
  await expect(modeSelect).toBeVisible();
  await expect(boundaryModeSelect).toBeVisible();
  await expect(modeSelect).toHaveValue("regular-random-walk");
  await expect(boundaryModeSelect).toHaveValue("wrap-around");
  await expect(page.locator("#random-walk-world-peerImpulseScale")).toHaveCount(0);
  await expect(page.locator("#random-walk-world-randomImpulseWeight")).toHaveCount(0);
  await expect(page.locator("#random-walk-world-neighborCohesionWeight")).toHaveCount(0);

  await modeSelect.selectOption("peer-influenced-random-walk");
  const peerImpulseScaleInput = page.locator("#random-walk-world-peerImpulseScale");
  const randomImpulseWeightInput = page.locator("#random-walk-world-randomImpulseWeight");
  const separationWeightInput = page.locator("#random-walk-world-separationWeight");
  const separationRadiusInput = page.locator("#random-walk-world-separationRadius");
  const maxSpeedMultiplierInput = page.locator("#random-walk-world-maxSpeedMultiplier");
  const velocityDampingCurveInput = page.locator("#random-walk-world-velocityDampingCurve");
  const centerAttractionInput = page.locator("#random-walk-world-centerAttraction");
  const massVarianceInput = page.locator("#random-walk-world-massVariance");
  const neighborCohesionWeightInput = page.locator("#random-walk-world-neighborCohesionWeight");
  await expect(peerImpulseScaleInput).toBeVisible();
  await expect(randomImpulseWeightInput).toBeVisible();
  await expect(separationWeightInput).toBeVisible();
  await expect(separationRadiusInput).toBeVisible();
  await expect(maxSpeedMultiplierInput).toBeVisible();
  await expect(velocityDampingCurveInput).toBeVisible();
  await expect(centerAttractionInput).toBeVisible();
  await expect(massVarianceInput).toBeVisible();
  await expect(neighborCohesionWeightInput).toBeVisible();
  await expect(peerImpulseScaleInput).toHaveValue("1.00");
  await expect(randomImpulseWeightInput).toHaveValue("1.00");
  await expect(neighborCohesionWeightInput).toHaveValue("0.00");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("mode=peer-influenced-random-walk");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_mode=wrap-around");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("push_strength=1.0000");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("random_impulse=1.0000");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("collapse_pull=0.0000");

  await peerImpulseScaleInput.fill("0.22");
  await expect(peerImpulseScaleInput).toHaveValue("0.22");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("push_strength=0.2200");

  await randomImpulseWeightInput.fill("0.08");
  await expect(randomImpulseWeightInput).toHaveValue("0.08");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("random_impulse=0.0800");

  await neighborCohesionWeightInput.scrollIntoViewIfNeeded();
  await neighborCohesionWeightInput.fill("2.40");
  await expect(neighborCohesionWeightInput).toHaveValue("2.40");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("collapse_pull=2.4000");

  await boundaryModeSelect.selectOption("bounce-back");
  await expect(boundaryModeSelect).toHaveValue("bounce-back");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("boundary_mode=bounce-back");
});

test("deterministic seed input reproduces identical contracts for same value and changes when value changes", async ({
  page,
}) => {
  await openRandomWalkControls(page, "random-walk-seed-controls");

  const seedInput = page.locator("#random-walk-world-seed");
  const baselineAt216 = (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd();

  await seedInput.fill("issue-34-seed-a");
  await expect(seedInput).toHaveValue("issue-34-seed-a");
  await expect
    .poll(async () => (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd(), {
      timeout: 10_000,
      intervals: [100, 200, 400],
    })
    .not.toBe(baselineAt216);
  const seedAAt216 = (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd();

  await seedInput.fill("issue-34-seed-b");
  await expect(seedInput).toHaveValue("issue-34-seed-b");
  await expect
    .poll(async () => (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd(), {
      timeout: 10_000,
      intervals: [100, 200, 400],
    })
    .not.toBe(seedAAt216);
  const seedBAt216 = (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd();
  expect(seedBAt216).not.toBe(seedAAt216);

  await seedInput.fill("issue-34-seed-a");
  await expect(seedInput).toHaveValue("issue-34-seed-a");
  await expect
    .poll(async () => (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd(), {
      timeout: 10_000,
      intervals: [100, 200, 400],
    })
    .toBe(seedAAt216);
  const seedAReplayAt216 = (await fetchRandomWalkContractAtMilestoneMs(page, 216)).trimEnd();
  expect(seedAReplayAt216).toBe(seedAAt216);
});

test("ambient friction updates on next frame and increases halting trend when raised", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-friction-controls");

  const modeSelect = page.locator("#random-walk-world-mode");
  await modeSelect.selectOption("peer-influenced-random-walk");
  await expect(modeSelect).toHaveValue("peer-influenced-random-walk");

  const frictionInput = page.locator("#random-walk-world-ambientFriction");
  await frictionInput.fill("0.00");
  await expect(frictionInput).toHaveValue("0.00");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("ambient_friction=0.0000");
  const lowFrictionAvgSpeed = parseContractMetric(await fetchRandomWalkContractAtMilestoneMs(page, 360), "avg_speed");

  await frictionInput.fill("0.90");
  await expect(frictionInput).toHaveValue("0.90");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("ambient_friction=0.9000");
  const highFrictionAvgSpeed = parseContractMetric(await fetchRandomWalkContractAtMilestoneMs(page, 360), "avg_speed");
  expect(highFrictionAvgSpeed).toBeLessThanOrEqual(lowFrictionAvgSpeed + 0.0025);

  await resetRandomWalkSimulationForScenario(page);
  const postResetHighFrictionAvgSpeed = parseContractMetric(await fetchRandomWalkContractAtMilestoneMs(page, 360), "avg_speed");
  expect(postResetHighFrictionAvgSpeed).toBeLessThanOrEqual(lowFrictionAvgSpeed + 0.0025);
});

test("camera orbit and zoom controls remain functional after parameter edits", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-camera-continuity-controls");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error("Expected canvas bounds to be available.");
  }

  const initialCamera = await fetchRandomWalkCameraState(page);
  const initialDistance = parseCameraDistance(initialCamera);

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 60);
  await page.mouse.up();
  await page.waitForTimeout(120);

  const rotatedCamera = await fetchRandomWalkCameraState(page);
  expect(rotatedCamera.position).not.toEqual(initialCamera.position);

  await page.locator("#random-walk-world-seed").fill("issue-34-camera-seed");
  await page.locator("#random-walk-world-stepScale").fill("0.031");
  await page.locator("#random-walk-world-boundaryExtent").fill("12.5");

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(120);

  const zoomedCamera = await fetchRandomWalkCameraState(page);
  const zoomedDistance = parseCameraDistance(zoomedCamera);
  expect(zoomedDistance).toBeLessThan(initialDistance);

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 80, bounds.y + bounds.height / 2 - 40);
  await page.mouse.up();
  await page.waitForTimeout(120);

  const finalCamera = await fetchRandomWalkCameraState(page);
  expect(finalCamera.position).not.toEqual(zoomedCamera.position);
});

test("frame progression stays bounded and deterministic across milestone updates", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-frame-progression-controls");

  const modeSelect = page.locator("#random-walk-world-mode");
  await modeSelect.selectOption("peer-influenced-random-walk");
  await page.locator("#random-walk-world-dotCount").fill("512");
  await page.locator("#random-walk-world-ambientFriction").fill("0.35");
  await page.locator("#random-walk-world-peerImpulseScale").fill("1.10");
  await page.locator("#random-walk-world-stepScale").fill("0.028");
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("dot_count=512");

  const baselineContract = await fetchRandomWalkContractAtMilestoneMs(page, 0);
  const sampled = await page.evaluate(() => {
    if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
    }
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }

    window.__GET_RANDOM_WALK_CONTRACT_TEXT__(0);
    window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
    const startedAtMs = performance.now();
    window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
    const contractAt360Ms = window.__GET_RANDOM_WALK_CONTRACT_TEXT__(360);
    return {
      contractAt360Ms,
      elapsedMs: performance.now() - startedAtMs,
    };
  });
  expect(sampled.elapsedMs).toBeLessThanOrEqual(600);

  const contracts = [baselineContract, sampled.contractAt360Ms];
  const frames = contracts.map((contract) => parseContractFrame(contract));
  const speeds = contracts.map((contract) => parseContractMetric(contract, "avg_speed"));
  const maxRadii = contracts.map((contract) => parseContractMetric(contract, "max_radius"));
  const stepScale = parseContractMetric(contracts[0], "step_scale");
  const boundaryExtent = parseContractMetric(contracts[0], "boundary_extent");

  for (let index = 1; index < frames.length; index += 1) {
    expect(frames[index]).toBeGreaterThan(frames[index - 1]);
  }

  for (const speed of speeds) {
    expect(speed).toBeGreaterThanOrEqual(0);
    expect(speed).toBeLessThanOrEqual(stepScale * 3 + 0.02);
  }

  const maxAllowedRadius = Math.sqrt(3 * boundaryExtent * boundaryExtent) + 0.0001;
  for (const maxRadius of maxRadii) {
    expect(maxRadius).toBeLessThanOrEqual(maxAllowedRadius);
  }
});

test("debounced controls batch rapid edits and show pending odometer cue", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-debounced-controls", { uiInputDebounceMs: 3000 });

  const stepScaleInput = page.locator("#random-walk-world-stepScale");
  await stepScaleInput.fill("0.023");
  await stepScaleInput.fill("0.024");
  await stepScaleInput.fill("0.025");
  await expect(page.locator("#random-walk-world-stepScale-pending-commit")).toBeVisible();
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("step_scale=0.0210");

  await page.waitForTimeout(3200);
  await expect.poll(async () => fetchRandomWalkContractAtMilestoneMs(page, 0)).toContain("step_scale=0.0250");
  await expect(page.locator("#random-walk-world-stepScale-pending-commit")).toHaveCount(0);
});

test("toroidal wrap preserves velocity vector", async () => {
  const port = createRandomWalkToroidalPhysicsPort();
  const boundary = {
    min: [-1, -1, -1] as const,
    max: [1, 1, 1] as const,
  };

  const positiveWrap = port.deriveToroidalWrapTransition(
    {
      position: [1.2, 0.2, -0.5],
      velocity: [0.1, 0.2, 0.3],
    },
    boundary,
  );

  expect(positiveWrap.wrapOccurred).toBe(true);
  expect(positiveWrap.nextPosition[0]).toBeCloseTo(-0.8, 6);
  expect(positiveWrap.nextPosition[1]).toBeCloseTo(0.2, 6);
  expect(positiveWrap.nextPosition[2]).toBeCloseTo(-0.5, 6);
  expect(positiveWrap.preservedVelocity).toEqual([0.1, 0.2, 0.3]);

  const negativeWrap = port.deriveToroidalWrapTransition(
    {
      position: [-0.25, -1.2, -1.4],
      velocity: [-0.3, 0.4, -0.5],
    },
    boundary,
  );

  expect(negativeWrap.wrapOccurred).toBe(true);
  expect(negativeWrap.nextPosition[0]).toBeCloseTo(-0.25, 6);
  expect(negativeWrap.nextPosition[1]).toBeCloseTo(0.8, 6);
  expect(negativeWrap.nextPosition[2]).toBeCloseTo(0.6, 6);
  expect(negativeWrap.preservedVelocity).toEqual([-0.3, 0.4, -0.5]);
});
