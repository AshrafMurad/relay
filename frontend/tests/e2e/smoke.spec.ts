import { expect, test } from "@playwright/test";

test("serves the public landing page and web health check", async ({ page, request }) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBe(true);

  await page.goto("/");
  await expect(page).toHaveTitle(/Relay/);
});
