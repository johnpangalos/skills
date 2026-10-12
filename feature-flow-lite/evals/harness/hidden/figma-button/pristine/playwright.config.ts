import { defineConfig, devices } from "@playwright/test";

// Renders the page in Chromium and compares the values it is drawn with against Figma's
// (figma/button.json, tests/figma.ts).
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5199", deviceScaleFactor: 1 },
  webServer: { command: "pnpm dev", url: "http://localhost:5199", reuseExistingServer: false },
});
