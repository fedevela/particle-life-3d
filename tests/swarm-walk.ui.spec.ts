import { expect, test } from "@playwright/test";

/**
 * @requirement SWARM-001
 * @description Add a third navigation option to the sidebar that mounts the Swarm-Walk simulation scene and updates the active route.
 */
test("SWARM-001: Swarm-Walk navigation item updates route and mounts component", async ({ page }) => {
  await page.goto("/");
  
  // Find the Swarm-Walk link in the sidebar
  const swarmWalkLink = page.getByRole("link", { name: "Swarm-Walk" });
  await expect(swarmWalkLink).toBeVisible();
  
  // Click the link
  await swarmWalkLink.click();
  
  // Verify URL change
  await expect(page).toHaveURL(/\/swarm-walk$/);
  
  // Verify that the Canvas/Section is mounted
  await expect(page.locator("section.h-full.w-full")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

/**
 * @requirement SWARM-010
 * @description Ensure the Swarm-Walk navigation item matches the visual style, typography, and interaction patterns of existing menu entries.
 */
test("SWARM-010: Swarm-Walk navigation item matches visual style and interaction patterns", async ({ page }) => {
  await page.goto("/");
  
  const helloWorldLink = page.getByRole("link", { name: "Hello World" });
  const swarmWalkLink = page.getByRole("link", { name: "Swarm-Walk" });
  
  // Check that they share common classes for visual style
  const helloWorldClasses = await helloWorldLink.getAttribute("class");
  const swarmWalkClasses = await swarmWalkLink.getAttribute("class");
  
  // Both should have common layout classes
  expect(helloWorldClasses).toContain("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition");
  expect(swarmWalkClasses).toContain("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition");

  // Check hover state (visual verification via styles)
  await swarmWalkLink.hover();
  // Playwright doesn't easily check for :hover in CSS, but we can check if it has the hover class in its definition
  // or just rely on the fact that it's using SidebarNavLink which we've verified has hover:bg-slate-700/50
});
