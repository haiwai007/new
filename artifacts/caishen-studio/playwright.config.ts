import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
const port = Number(process.env.E2E_PORT ?? 5174);
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      process.env.CMS_E2E === "1"
        ? "node ../../scripts/cms-local-server.mjs"
        : process.env.E2E_PRODUCTION === "1"
          ? "pnpm run serve"
          : "pnpm run dev",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(port),
      BASE_PATH: "/",
      VITE_CONVEX_URL: "",
      VITE_HERCULES_OIDC_AUTHORITY: "",
      VITE_HERCULES_OIDC_CLIENT_ID: "",
    },
  },
});
