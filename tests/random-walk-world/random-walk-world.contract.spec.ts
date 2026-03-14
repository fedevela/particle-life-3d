import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RANDOM_WALK_MILESTONES_MS = [0, 72, 144, 216, 288, 360] as const;
const FIXTURE_SEED = "random-walk-fixture-seed-v1";

const CASES = RANDOM_WALK_MILESTONES_MS.map((timeMs) => ({
  timeMs,
  fixtureName: `random-walk-world.ms-${String(timeMs).padStart(3, "0")}.txt`,
}));

async function readContractFixture(fileName: string) {
  const fixturePath = path.join(__dirname, "contracts", fileName);
  return readFile(fixturePath, "utf8");
}

async function waitForTestApis(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ === "function",
        hasGetFrame: typeof window.__GET_RANDOM_WALK_FRAME__ === "function",
        hasReset: typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ === "function",
      }));
    })
    .toEqual({ hasGetContract: true, hasGetFrame: true, hasReset: true });
}

async function resetSimulation(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_RANDOM_WALK_SIM_FOR_TEST__ is not available.");
    }

    await window.__RESET_RANDOM_WALK_SIM_FOR_TEST__();
  });
}

async function getRandomWalkContractText(page: Page, timeMs: number) {
  return page.evaluate(async ({ targetTimeMs }: { targetTimeMs: number }) => {
    if (typeof window.__GET_RANDOM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_RANDOM_WALK_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_RANDOM_WALK_CONTRACT_TEXT__(targetTimeMs);
  }, { targetTimeMs: timeMs });
}

test.describe.serial("random-walk-world deterministic milestones contract", () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    const setupPage = page;
    await setupPage.goto(`/random-walk-world?testMode=true&seed=${FIXTURE_SEED}`);
    await waitForTestApis(setupPage);
    await resetSimulation(setupPage);
  });

  for (const { timeMs, fixtureName } of CASES) {
    test(`random walk contract at ${timeMs}ms`, async () => {
      if (!page) {
        throw new Error("Expected test page to be initialized in beforeAll.");
      }

      const testPage = page;
      const expectedFixture = (await readContractFixture(fixtureName)).trimEnd();
      const actual = (await getRandomWalkContractText(testPage, timeMs)).trimEnd();
      expect(actual).toBe(expectedFixture);
    });
  }

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
