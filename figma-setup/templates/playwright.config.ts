import { defineConfig, devices } from "@playwright/test";

// Renders pages in Chromium and compares the values they are drawn with against Figma's
// (see the exports folder and tests/figma.ts). Replace the three placeholders.
const url = "http://localhost:<PORT>";

export default defineConfig({
  testDir: "<TESTS DIR>",
  // Only the Figma specs, so this config can sit beside other Playwright tests.
  testMatch: "**/*.figma.spec.ts",
  fullyParallel: true,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: url, deviceScaleFactor: 1 },
  webServer: { command: "<DEV SERVER COMMAND>", url, reuseExistingServer: !process.env.CI },
});
