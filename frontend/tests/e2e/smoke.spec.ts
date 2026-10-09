import { expect, test } from "@playwright/test";

test("serves the public landing page and web health check", async ({ page, request }) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);

  const response = await page.goto("/");
  await expect(page).toHaveTitle(/Relay/);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("script-src 'self' 'nonce-");
  expect(headers["content-security-policy"]).toContain("'strict-dynamic'");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  // The external theme bootstrap must remain executable under the strict policy.
  const themeBootstrap = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(themeBootstrap).toBe("dark");
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
