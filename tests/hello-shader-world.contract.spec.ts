import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHADER_MILESTONE_FRAMES = [0, 30, 60, 90] as const;

const MILESTONE_CASES = SHADER_MILESTONE_FRAMES.map((frame) => ({
  frame,
  fixtureName: `hello-shader-world.frame-${String(frame).padStart(3, "0")}.txt`,
}));

async function readContractFixture(fileName: string) {
  const fixturePath = path.join(__dirname, "contracts", fileName);
  return readFile(fixturePath, "utf8");
}

async function waitForTestApis(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_SHADER_CONTRACT_TEXT__ === "function",
        hasGetFrame: typeof window.__GET_SHADER_FRAME__ === "function",
        hasReset: typeof window.__RESET_SHADER_SIM_FOR_TEST__ === "function",
      }));
    }, { timeout: 20000 })
    .toEqual({ hasGetContract: true, hasGetFrame: true, hasReset: true });
}

async function resetSimulation(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_SHADER_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_SHADER_SIM_FOR_TEST__ is not available.");
    }

    await window.__RESET_SHADER_SIM_FOR_TEST__();
  });
}

async function getShaderContractText(page: Page, frame: number) {
  return page.evaluate(async ({ targetFrame }: { targetFrame: number }) => {
    if (typeof window.__GET_SHADER_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_SHADER_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_SHADER_CONTRACT_TEXT__(targetFrame);
  }, { targetFrame: frame });
}

test.describe.serial("hello-shader-world GPU milestone contract", () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    const setupPage = page;
    await setupPage.goto("/hello-shader-world?testMode=true&seed=shader-milestone");
    await waitForTestApis(setupPage);
    await resetSimulation(setupPage);
  });

  for (const { frame, fixtureName } of MILESTONE_CASES) {
    test(`shader contract at frame ${frame}`, async () => {
      if (!page) {
        throw new Error("Expected test page to be initialized in beforeAll.");
      }

      const testPage = page;

      const expectedFixture = await readContractFixture(fixtureName);

      await expect
        .poll(
          async () => {
            try {
              return await getShaderContractText(testPage, frame);
            } catch {
              return null;
            }
          },
          { timeout: 20000 },
        )
        .toBe(expectedFixture);
    });
  }

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
