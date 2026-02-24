import { expect, test } from "@playwright/test";

test("hello-world renders shell navigation and canvas", async ({ page }) => {
  const projectId = `pw-hello-world-ui-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  try {
    await page.goto(`/hello-world?testMode=true&projectId=${projectId}&seed=hello`);

    await expect
      .poll(async () => {
        return page.evaluate(() => typeof window.__DELETE_PROJECT_DATA__ === "function");
      })
      .toBe(true);

    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("button", { name: /navigation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Hello World" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  } finally {
    await page.evaluate(async (nextProjectId) => {
      if (typeof window.__DELETE_PROJECT_DATA__ === "function") {
        await window.__DELETE_PROJECT_DATA__(nextProjectId);
      }
    }, projectId);
  }
});
