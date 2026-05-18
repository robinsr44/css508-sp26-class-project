import { defineConfig, devices } from "@playwright/test";

const skipWebServer = !!process.env.PLAYWRIGHT_SKIP_WEBSERVER;

/**
 * Browser E2E against **live** moon-api (default http://127.0.0.1:8080) while Vite proxies `/api`.
 * Prerequisite: start `moon-api` before `npm run test:e2e`, or use Docker Compose on port 8080
 * with UI reachable at baseURL if you adjust env (see README).
 *
 * Override health URL: `MOON_API_HEALTH_URL=http://host:port/api/health`
 *
 * Docker Compose UI + API on **8080**: `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e`
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 5173",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
