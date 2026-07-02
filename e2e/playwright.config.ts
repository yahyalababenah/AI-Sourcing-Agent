import { defineConfig, devices } from "@playwright/test";

// Local environment: docker-compose.test.yml backend (port 8001) + a Vite
// dev server for the frontend, pointed at that backend. To run against a
// real staging deployment instead, set PLAYWRIGHT_BASE_URL and skip
// `webServer` won't be started (Playwright assumes the target is already up).
const STAGING_URL = process.env.PLAYWRIGHT_BASE_URL;
const LOCAL_FRONTEND_URL = "http://localhost:5173";
const LOCAL_API_URL = "http://localhost:8001/api/v1";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // several specs (multi-tab chat, exclusive-window timing) need serial execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: STAGING_URL || LOCAL_FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: STAGING_URL
    ? undefined
    : {
        command: `cd ../frontend && VITE_API_URL=${LOCAL_API_URL} npm run dev -- --port 5173`,
        url: LOCAL_FRONTEND_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
