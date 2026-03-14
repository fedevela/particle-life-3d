import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RANDOM_WALK_MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const FIXTURE_SEED = "random-walk-fixture-seed-v1";
const SHOULD_UPDATE_CONTRACTS = process.env.UPDATE_RANDOM_WALK_CONTRACTS === "1";

const RANDOM_WALK_CONTRACT_MILESTONE_CASES = RANDOM_WALK_MILESTONES_MS.map((timeMs) => ({
  timeMs,
  fixtureName: `random-walk-world.ms-${String(timeMs).padStart(3, "0")}.txt`,
}));

async function readRandomWalkContractFixture(fileName: string) {
  const fixturePath = path.join(__dirname, "contracts", fileName);
  return readFile(fixturePath, "utf8");
}

function getRandomWalkContractFixturePath(fileName: string) {
  return path.join(__dirname, "contracts", fileName);
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

async function resetRandomWalkSimulationForMilestones(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }

    await window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
  });
}

async function fetchRandomWalkContractTextAtTimeMs(page: Page, timeMs: number) {
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
        await waitForRandomWalkContractTestGlobals(page);
      }
      await page.waitForTimeout(100);
    }
  }

  throw new Error("Failed to read random walk contract text after retries.");
}

test.describe.serial("random-walk-world deterministic milestones contract", () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    const setupPage = page;
    await setupPage.goto(`/random-walk-world?testMode=true&seed=${FIXTURE_SEED}`);
    await waitForRandomWalkContractTestGlobals(setupPage);
    await resetRandomWalkSimulationForMilestones(setupPage);
  });

  for (const { timeMs, fixtureName } of RANDOM_WALK_CONTRACT_MILESTONE_CASES) {
    test(`random walk contract at ${timeMs}ms`, async () => {
      if (!page) {
        throw new Error("Expected test page to be initialized in beforeAll.");
      }

      const testPage = page;
      const actual = (await fetchRandomWalkContractTextAtTimeMs(testPage, timeMs)).trimEnd();
      const fixturePath = getRandomWalkContractFixturePath(fixtureName);

      if (SHOULD_UPDATE_CONTRACTS) {
        await mkdir(path.dirname(fixturePath), { recursive: true });
        await writeFile(fixturePath, `${actual}\n`, "utf8");
        return;
      }

      const expectedFixture = (await readRandomWalkContractFixture(fixtureName)).trimEnd();
      expect(actual).toBe(expectedFixture);
    });
  }

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
