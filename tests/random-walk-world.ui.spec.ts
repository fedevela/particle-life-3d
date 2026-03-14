import { expect, test } from "@playwright/test";

import { createRandomWalkToroidalPhysicsPort } from "../app/features/3d/random-walk-world-physics-seam";

test("random-walk-world is accessible from third left menu option with controls and canvas", async ({ page }) => {
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

test("toroidal boundary wrapping preserves velocity vector", async () => {
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
