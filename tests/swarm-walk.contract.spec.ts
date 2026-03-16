import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readContractFixture(fileName: string) {
  const fixturePath = path.join(__dirname, "contracts", fileName);
  return readFile(fixturePath, "utf8");
}

async function waitForTestApis(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_SWARM_WALK_CONTRACT_TEXT__ === "function",
        hasGetFrame: typeof window.__GET_SWARM_WALK_FRAME__ === "function",
        hasReset: typeof window.__RESET_SWARM_WALK_SIM_FOR_TEST__ === "function",
      }));
    }, { timeout: 10000 })
    .toEqual({ hasGetContract: true, hasGetFrame: true, hasReset: true });
}

test("SWARM-001: Swarm-Walk simulation scene contract", async ({ page }) => {
  await page.goto("/swarm-walk?testMode=true&seed=swarm-test");
  await waitForTestApis(page);

  const expectedFixture = await readContractFixture("swarm-walk.initial.txt");

  const contractText = await page.evaluate(async () => {
    if (typeof window.__GET_SWARM_WALK_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_SWARM_WALK_CONTRACT_TEXT__ is not available.");
    }
    return window.__GET_SWARM_WALK_CONTRACT_TEXT__(0);
  });

  expect(contractText).toBe(expectedFixture);
});
