import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { CAMERA_ACTIONS, type CameraAction } from "../../app/features/3d/hello-world/camera-actions";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAMERA_CONTRACT_MILESTONE_CASES = CAMERA_ACTIONS.map((action, index) => ({
  action,
  fixtureName: `hello-world.camera.step-${String(index + 1).padStart(2, "0")}.txt`,
}));

function toCameraActionLabel(action: CameraAction) {
  return action.replaceAll("_", " ");
}

async function readHelloWorldContractFixture(fileName: string) {
  const fixturePath = path.join(__dirname, "contracts", fileName);
  return readFile(fixturePath, "utf8");
}

function buildIsolatedContractTestProjectId() {
  return `pw-hello-world-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function waitForHelloWorldContractTestGlobals(page: Page) {
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        hasGet: typeof window.__GET_DB_CONTRACT_TEXT__ === "function",
        hasApply: typeof window.__APPLY_CAMERA_ACTION_FOR_TEST__ === "function",
        hasDelete: typeof window.__DELETE_PROJECT_DATA__ === "function",
      }));
    })
    .toEqual({ hasGet: true, hasApply: true, hasDelete: true });
}

async function fetchHelloWorldDbContractText(page: Page, projectId: string) {
  return page.evaluate(async ({ nextProjectId }: { nextProjectId: string }) => {
    if (typeof window.__GET_DB_CONTRACT_TEXT__ !== "function") {
      throw new Error("window.__GET_DB_CONTRACT_TEXT__ is not available.");
    }

    return window.__GET_DB_CONTRACT_TEXT__(nextProjectId);
  }, { nextProjectId: projectId });
}

async function applyCameraActionContractStep(page: Page, action: CameraAction, projectId: string) {
  await page.evaluate(
    async ({ nextAction, nextProjectId }: { nextAction: CameraAction; nextProjectId: string }) => {
      if (typeof window.__APPLY_CAMERA_ACTION_FOR_TEST__ !== "function") {
        throw new Error("window.__APPLY_CAMERA_ACTION_FOR_TEST__ is not available.");
      }

      await window.__APPLY_CAMERA_ACTION_FOR_TEST__(nextAction, nextProjectId);
    },
    { nextAction: action, nextProjectId: projectId },
  );
}

async function purgeHelloWorldProjectData(page: Page, projectId: string) {
  await page.evaluate(async ({ nextProjectId }: { nextProjectId: string }) => {
    if (typeof window.__DELETE_PROJECT_DATA__ !== "function") {
      return;
    }

    await window.__DELETE_PROJECT_DATA__(nextProjectId);
  }, { nextProjectId: projectId });
}

test.describe.serial("hello-world camera DB contract", () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let projectId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const setupProjectId = buildIsolatedContractTestProjectId();
    projectId = setupProjectId;
    context = await browser.newContext();
    page = await context.newPage();

    const setupPage = page;

    await setupPage.goto(`/hello-world?testMode=true&projectId=${setupProjectId}&seed=hello`);
    await waitForHelloWorldContractTestGlobals(setupPage);

    const initialFixture = await readHelloWorldContractFixture("hello-world.initial.txt");
    await expect.poll(async () => fetchHelloWorldDbContractText(setupPage, setupProjectId)).toBe(initialFixture);
  });

  for (const { action, fixtureName } of CAMERA_CONTRACT_MILESTONE_CASES) {
    test(`camera action: ${toCameraActionLabel(action)}`, async () => {
      if (!page || !projectId) {
        throw new Error("Expected test page and projectId to be initialized in beforeAll.");
      }

      const testPage = page;
      const testProjectId = projectId;

      await applyCameraActionContractStep(testPage, action, testProjectId);

      const expectedFixture = await readHelloWorldContractFixture(fixtureName);
      await expect.poll(async () => fetchHelloWorldDbContractText(testPage, testProjectId)).toBe(expectedFixture);
    });
  }

  test.afterAll(async () => {
    if (page && projectId) {
      try {
        await purgeHelloWorldProjectData(page, projectId);
      } catch {
        // Ignore teardown cleanup errors to keep primary test failure output clear.
      }
    }

    if (context) {
      await context.close();
    }
  });
});
