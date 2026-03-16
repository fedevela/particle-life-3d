import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { checkOrUpdateFixture } from "./contracts/fixture-helper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "contracts");

const SHADER_MILESTONE_FRAMES = [0, 30, 60, 90] as const;

const MILESTONE_CASES = SHADER_MILESTONE_FRAMES.map((frame) => ({
  frame,
  fixtureName: `hello-shader-world.frame-${String(frame).padStart(3, "0")}.txt`,
}));

async function waitForTestApis(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGetContract: typeof window.__GET_SHADER_CONTRACT_TEXT__ === "function",
        hasGetFrame: typeof window.__GET_SHADER_FRAME__ === "function",
        hasReset: typeof window.__RESET_SHADER_SIM_FOR_TEST__ === "function",
      }));
    })
    .toEqual({ hasGetContract: true, hasGetFrame: true, hasReset: true });
}

async function resetSimulation(page: Page) {
  await expect
    .poll(
      async () => {
        try {
          await page.evaluate(async () => {
            if (typeof window.__RESET_SHADER_SIM_FOR_TEST__ !== "function") {
              throw new Error("window.__RESET_SHADER_SIM_FOR_TEST__ is not available.");
            }

            await window.__RESET_SHADER_SIM_FOR_TEST__();
          });

          return true;
        } catch {
          return false;
        }
      },
    )
    .toBe(true);
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
  const pageErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    const setupPage = page;
    await setupPage.goto("/hello-shader-world?testMode=true&seed=shader-milestone");
    if (pageErrors.length > 0) {
      throw new Error(`Shader page runtime error: ${pageErrors[0]}`);
    }
    await waitForTestApis(setupPage);
    await resetSimulation(setupPage);
  });

  for (const { frame, fixtureName } of MILESTONE_CASES) {
    test(`shader contract at frame ${frame}`, async () => {
      if (!page) {
        throw new Error("Expected test page to be initialized in beforeAll.");
      }

      const testPage = page;

      await expect
        .poll(
          async () => {
            try {
              const actualText = await getShaderContractText(testPage, frame);
              await checkOrUpdateFixture(FIXTURES_DIR, fixtureName, actualText);
              return true;
            } catch {
              return false;
            }
          },
          { timeout: 15000 }
        )
        .toBe(true);
    });
  }

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
