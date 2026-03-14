import { expect, test, type Page } from "@playwright/test";

async function waitForShaderTestApis(page: Page) {
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

async function resetShaderSimulation(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.__RESET_SHADER_SIM_FOR_TEST__ !== "function") {
      throw new Error("window.__RESET_SHADER_SIM_FOR_TEST__ is not available.");
    }

    await window.__RESET_SHADER_SIM_FOR_TEST__();
  });
}

async function getShaderContractAtFrame(page: Page, targetFrame: number) {
  return expect
    .poll(
      async () => {
        return page.evaluate(async ({ frame }: { frame: number }) => {
          if (typeof window.__GET_SHADER_CONTRACT_TEXT__ !== "function") {
            return null;
          }

          try {
            return await window.__GET_SHADER_CONTRACT_TEXT__(frame);
          } catch {
            return null;
          }
        }, { frame: targetFrame });
      },
      { timeout: 15_000 },
    )
    .not.toBeNull()
    .then(async () => {
      return page.evaluate(async ({ frame }: { frame: number }) => {
        if (typeof window.__GET_SHADER_CONTRACT_TEXT__ !== "function") {
          throw new Error("window.__GET_SHADER_CONTRACT_TEXT__ is not available.");
        }

        return window.__GET_SHADER_CONTRACT_TEXT__(frame);
      }, { frame: targetFrame });
    });
}

test("hello-shader-world viewport renders and simulation frame advances", async ({ page }) => {
  await page.goto("/hello-shader-world?testMode=true&seed=shader-ui-viewport");
  await waitForShaderTestApis(page);
  await expect(page.locator("canvas")).toBeVisible();

  const viewportMetrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const hasContext = canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null;

    return {
      width: canvas.width,
      height: canvas.height,
      hasContext,
    };
  });

  expect(viewportMetrics).not.toBeNull();
  expect(viewportMetrics?.width ?? 0).toBeGreaterThan(0);
  expect(viewportMetrics?.height ?? 0).toBeGreaterThan(0);
  expect(viewportMetrics?.hasContext).toBe(true);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return typeof window.__GET_SHADER_FRAME__ === "function" ? window.__GET_SHADER_FRAME__() : -1;
      });
    })
    .toBeGreaterThan(20);

  await resetShaderSimulation(page);
  const frameZeroContract = await getShaderContractAtFrame(page, 0);
  const frameThirtyContract = await getShaderContractAtFrame(page, 30);
  expect(frameZeroContract).toContain("frame=0");
  expect(frameThirtyContract).toContain("frame=30");
  expect(frameThirtyContract).not.toBe(frameZeroContract);
});

test("hello-shader-world movement controls update deterministic output", async ({ page }) => {
  await page.goto("/hello-shader-world?testMode=true&seed=shader-ui-controls");
  await waitForShaderTestApis(page);
  await expect(page.locator("canvas")).toBeVisible();

  await resetShaderSimulation(page);
  const baselineFrame30 = await getShaderContractAtFrame(page, 30);

  await page.getByRole("link", { name: "Hello Shader World" }).click();
  await expect(page.locator("#hello-shader-world-acceleration")).toBeVisible();

  await page.locator("#hello-shader-world-acceleration").fill("0.006");
  await page.locator("#hello-shader-world-directionJitter").fill("0.12");
  await page.locator("#hello-shader-world-maxSpeed").fill("0.05");

  await resetShaderSimulation(page);
  const updatedFrame30 = await getShaderContractAtFrame(page, 30);

  expect(updatedFrame30).not.toBe(baselineFrame30);
  expect(updatedFrame30).toContain("frame=30");
});
