import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use a pre-installed Chromium when available (e.g. CI images), otherwise Playwright's own.
const exe = process.env.PW_CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: exe ? { executablePath: exe } : {},
    trace: "retain-on-failure",
  },
  // Tests run against the static production build (npm run build first).
  webServer: {
    command: `npx serve out -l ${PORT} --no-clipboard`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
