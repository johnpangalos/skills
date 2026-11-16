import { defineConfig, devices } from "@playwright/test";

// Renders pages in Chromium and compares the values they are drawn with against Figma's
// (see the exports folder and tests/figma.ts). Replace the three placeholders.
const url = "http://localhost:5174";

export default defineConfig({
  testDir: "./tests",
  // Only the Figma specs (and the helper's own self-test), so this config can sit beside other
  // Playwright tests.
  testMatch: ["**/*.figma.spec.ts", "**/figma-helper.spec.ts"],
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: url,
    deviceScaleFactor: 1,
    // This sandbox has only /opt/pw-browsers/chromium, not the build this Playwright version
    // asks for.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: "pnpm dev", url, reuseExistingServer: !process.env.CI },
});
