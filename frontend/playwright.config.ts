import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && node scripts/start-e2e.mjs",
        url: "http://127.0.0.1:3100/healthz",
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_API_URL: "https://relay.example.com/api",
          NEXT_PUBLIC_SOCKET_URL: "https://relay.example.com",
        },
      },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
