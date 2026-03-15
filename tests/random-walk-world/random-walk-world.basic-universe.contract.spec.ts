import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RANDOM_WALK_MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const FIXTURE_SEED = "random-walk-basic-universe-min-dot-count-v1";
const SHOULD_UPDATE_CONTRACTS = process.env.UPDATE_RANDOM_WALK_CONTRACTS === "1";
const FIXTURE_DIR = path.join(__dirname, "contracts", "basic-universe.min-dot-count");

type MilestoneFixtureCase = {
  timeMs: (typeof RANDOM_WALK_MILESTONES_MS)[number];
  fixtureName: string;
};

const BASIC_UNIVERSE_MILESTONE_CASES: readonly MilestoneFixtureCase[] = RANDOM_WALK_MILESTONES_MS.map((timeMs) => ({
  timeMs,
  fixtureName: `random-walk-world.ms-${String(timeMs).padStart(3, "0")}.txt`,
}));

async function readBasicUniverseFixture(fileName: string) {
  const fixturePath = path.join(FIXTURE_DIR, fileName);
  return readFile(fixturePath, "utf8");
}

function getBasicUniverseFixturePath(fileName: string) {
  return path.join(FIXTURE_DIR, fileName);
}

async function waitForRandomWalkContractTestGlobals(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ === "function",
        hasGetFrame: typeof window.__GET_RANDOM_WALK_FRAME__ === "function",
        hasReset: typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ === "function",
      }));
    }, { timeout: 15_000, intervals: [100, 250, 500] })
    .toEqual({ hasGetContract: true, hasGetFrame: true, hasReset: true });
}

async function resetRandomWalkSimulation(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }

    await window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
  });
}

async function getRandomWalkContractAtTimeMs(page: Page, timeMs: number) {
  return page.evaluate(async ({ targetTimeMs }: { targetTimeMs: number }) => {
    if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_RANDOM_WALK_CONTRACT_TEXT__(targetTimeMs);
  }, { targetTimeMs: timeMs });
}

async function openBasicUniversePage(page: Page) {
  await page.goto(`/random-walk-world?testMode=true&seed=${FIXTURE_SEED}&uiInputDebounceMs=0`);
  await waitForRandomWalkContractTestGlobals(page);

  const dotCountInput = page.locator("#random-walk-world-dotCount");
  if (!(await dotCountInput.isVisible())) {
    await page.getByRole("link", { name: "Swarm Simulator" }).click();
  }

  await expect(dotCountInput).toBeVisible();
  await dotCountInput.fill("64");
  await expect(dotCountInput).toHaveValue("64");
  await expect
    .poll(async () => getRandomWalkContractAtTimeMs(page, 0), { timeout: 10_000, intervals: [100, 250, 500] })
    .toContain("dot_count=64");
  await resetRandomWalkSimulation(page);
}

test.describe.serial("random-walk-world basic universe webgl contract capture", () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await openBasicUniversePage(page);
  });

  test("captures and validates 72ms milestones through 360ms", async () => {
    if (!page) {
      throw new Error("Expected page to be initialized in beforeAll.");
    }

    for (const { timeMs, fixtureName } of BASIC_UNIVERSE_MILESTONE_CASES) {
      const actual = (await getRandomWalkContractAtTimeMs(page, timeMs)).trimEnd();
      const fixturePath = getBasicUniverseFixturePath(fixtureName);

      if (SHOULD_UPDATE_CONTRACTS) {
        await mkdir(path.dirname(fixturePath), { recursive: true });
        await writeFile(fixturePath, `${actual}\n`, "utf8");
        continue;
      }

      const expected = (await readBasicUniverseFixture(fixtureName)).trimEnd();
      expect(actual).toBe(expected);
    }
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
