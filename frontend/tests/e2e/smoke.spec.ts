import { expect, test } from "@playwright/test";

test("serves the public landing page and web health check", async ({ page, request }) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);

  await page.goto("/");
  await expect(page).toHaveTitle(/Relay/);
  const publicNavigation = page.getByRole("navigation", { name: "Public navigation" });
  await expect(publicNavigation).toBeVisible();
  await expect(publicNavigation.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(publicNavigation.getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("shares public navigation across auth routes and persists theme", async ({ page }) => {
  await page.goto("/login?next=%2Fapp");
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.goto("/signup?next=%2Fapp");
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
