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

async function waitForRandomWalkTestApis(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ === "function",
      }));
    })
    .toEqual({ hasGetContract: true });
}

async function getRandomWalkContractAtTimeMs(page: Page, timeMs = 0) {
  return page.evaluate(async ({ targetTimeMs }: { targetTimeMs: number }) => {
    if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_RANDOM_WALK_CONTRACT_TEXT__(targetTimeMs);
  }, { targetTimeMs: timeMs });
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
  for (const milestoneMs of CONTRACT_MILESTONES_MS) {
    const actual = (await getRandomWalkContractAtTimeMs(page, milestoneMs)).trimEnd();
    const fixturePath = getScenarioContractPath(scenario, milestoneMs);

    if (SHOULD_UPDATE_CONTRACTS) {
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, `${actual}\n`, "utf8");
      continue;
    }

    const expected = (await readFile(fixturePath, "utf8")).trimEnd();
    expect(actual).toBe(expected);
  }
}

async function openRandomWalkControls(page: Page, seed: string) {
  await page.goto(`/random-walk-world?testMode=true&seed=${seed}`);
  await waitForRandomWalkTestApis(page);

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  if (!(await dotCountInput.isVisible())) {
    const randomWalkLink = page.getByRole("link", { name: "Random Walk Sphere" });
    await randomWalkLink.click();
  }

  await expect(page).toHaveURL(/\/random-walk-world(?:\?.*)?$/);
  await expect(page.locator("#random-walk-world-dotCount")).toBeVisible();
  await expect(page.locator("#random-walk-world-stepScale")).toBeVisible();
  await expect(page.locator("#random-walk-world-boundaryExtent")).toBeVisible();
}

test("menu link opens random-walk scene and controls", async ({ page }) => {
  await page.goto("/");

  const links = page.locator("aside nav a");
  await expect(links).toHaveCount(3);
  await expect(links.nth(2)).toContainText("Random Walk Sphere");

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
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("dot_count=4096");

  await dotCountInput.fill("1");
  await expect(dotCountInput).toHaveValue("64");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("dot_count=64");

  await dotCountInput.fill("999999");
  await expect(dotCountInput).toHaveValue("65536");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("dot_count=65536");
  await assertScenarioContracts(page, "random-walk-world.ui-dot-count-clamp");
});

test("step scale input updates and clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-step-scale-controls");
  const stepScaleInput = page.locator("#random-walk-world-stepScale");

  await stepScaleInput.fill("0.023");
  await expect(stepScaleInput).toHaveValue("0.023");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("step_scale=0.0230");

  await stepScaleInput.fill("0");
  await expect(stepScaleInput).toHaveValue("0.001");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("step_scale=0.0010");

  await stepScaleInput.fill("0.999");
  await expect(stepScaleInput).toHaveValue("0.100");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("step_scale=0.1000");
  await assertScenarioContracts(page, "random-walk-world.ui-step-scale-clamp");
});

test("boundary extent input updates and clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-boundary-controls");
  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");

  await boundaryExtentInput.fill("4.75");
  await expect(boundaryExtentInput).toHaveValue("4.75");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("boundary_extent=4.7500");

  await boundaryExtentInput.fill("0");
  await expect(boundaryExtentInput).toHaveValue("0.25");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("boundary_extent=0.2500");

  await boundaryExtentInput.fill("100");
  await expect(boundaryExtentInput).toHaveValue("10.00");
  await expect.poll(async () => getRandomWalkContractAtTimeMs(page, 0)).toContain("boundary_extent=10.0000");
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
  await expect(stepScaleInput).toHaveValue("0.011");
  await wheelInput(stepScaleInput, 120);
  await expect(stepScaleInput).toHaveValue("0.010");

  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");
  await wheelInput(boundaryExtentInput, -120);
  await expect(boundaryExtentInput).toHaveValue("2.55");
  await wheelInput(boundaryExtentInput, 120);
  await expect(boundaryExtentInput).toHaveValue("2.50");
  await assertScenarioContracts(page, "random-walk-world.ui-wheel-cycle");
});

test("wheel respects min and max clamps", async ({ page }) => {
  await openRandomWalkControls(page, "random-walk-wheel-clamp-controls");

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  await dotCountInput.fill("65536");
  await wheelInput(dotCountInput, -120);
  await expect(dotCountInput).toHaveValue("65536");

  const stepScaleInput = page.locator("#random-walk-world-stepScale");
  await stepScaleInput.fill("0.001");
  await wheelInput(stepScaleInput, 120);
  await expect(stepScaleInput).toHaveValue("0.001");

  const boundaryExtentInput = page.locator("#random-walk-world-boundaryExtent");
  await boundaryExtentInput.fill("10");
  await wheelInput(boundaryExtentInput, -120);
  await expect(boundaryExtentInput).toHaveValue("10.00");
  await assertScenarioContracts(page, "random-walk-world.ui-wheel-clamp");
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
