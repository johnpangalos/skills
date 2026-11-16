import { defineConfig, devices } from "@playwright/test";

// Renders pages in Chromium and compares the values they are drawn with against Figma's
// (see the exports folder and tests/figma.ts). Replace the three placeholders: 5186,
// ./tests and pnpm dev --strictPort.
const url = "http://localhost:5186";

export default defineConfig({
  testDir: "./tests",
  // Only the Figma specs, so this config can sit beside other Playwright tests.
  testMatch: "**/*.figma.spec.ts",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: url,
    deviceScaleFactor: 1,
    // Where the Chromium build this Playwright version asks for isn't installed and can't be, point
    // PW_CHROMIUM at a Chromium that is: PW_CHROMIUM=/path/to/chromium pnpm test:figma.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  // Reuses whatever already answers on the port: keep it one no other app uses.
  webServer: { command: "pnpm dev --strictPort", url, reuseExistingServer: !process.env.CI },
});
