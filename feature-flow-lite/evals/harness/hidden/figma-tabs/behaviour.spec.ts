import { expect, test, type Page } from "@playwright/test";

// The WAI-ARIA tabs pattern, as the prompt asks for it. Hidden from the build.
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("roles, labels and the roving tab stop", async ({ page }) => {
  await expect(page.getByRole("tablist")).toHaveAttribute("aria-label", /.+/);
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(tab(page, "Overview")).toHaveAttribute("aria-selected", "true");
  await expect(tab(page, "Activity")).toHaveAttribute("aria-selected", "false");
  await expect(tab(page, "Overview")).toHaveAttribute("tabindex", "0");
  await expect(tab(page, "Activity")).toHaveAttribute("tabindex", "-1");
  await expect(tab(page, "Settings")).toBeDisabled();
});

test("the panel is tied to its tab, and only the selected one shows", async ({ page }) => {
  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveText("Overview panel");
  const tabId = await tab(page, "Overview").getAttribute("id");
  const panelId = await panel.getAttribute("id");
  expect(tabId).toBeTruthy();
  expect(panelId).toBeTruthy();
  await expect(panel).toHaveAttribute("aria-labelledby", tabId!);
  await expect(tab(page, "Overview")).toHaveAttribute("aria-controls", panelId!);
});

test("a click selects a tab and shows its panel", async ({ page }) => {
  await tab(page, "Activity").click();
  await expect(tab(page, "Activity")).toHaveAttribute("aria-selected", "true");
  await expect(tab(page, "Overview")).toHaveAttribute("aria-selected", "false");
  await expect(tab(page, "Activity")).toHaveAttribute("tabindex", "0");
  await expect(page.getByRole("tabpanel")).toHaveText("Activity panel");
});

test("a disabled tab can't be selected", async ({ page }) => {
  await tab(page, "Settings").click({ force: true });
  await expect(tab(page, "Overview")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveText("Overview panel");
});

test("arrow keys move and select, wrapping and skipping the disabled tab", async ({ page }) => {
  await page.keyboard.press("Tab");
  await expect(tab(page, "Overview")).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Activity")).toBeFocused();
  await expect(tab(page, "Activity")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveText("Activity panel");

  await page.keyboard.press("ArrowRight"); // Settings is disabled: wrap to Overview
  await expect(tab(page, "Overview")).toBeFocused();
  await expect(tab(page, "Overview")).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowLeft"); // wraps backwards past Settings
  await expect(tab(page, "Activity")).toBeFocused();
  await expect(tab(page, "Activity")).toHaveAttribute("aria-selected", "true");
});

test("Home and End jump to the first and last enabled tab", async ({ page }) => {
  await tab(page, "Activity").click();
  await page.keyboard.press("Home");
  await expect(tab(page, "Overview")).toBeFocused();
  await expect(tab(page, "Overview")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tab(page, "Activity")).toBeFocused();
  await expect(tab(page, "Activity")).toHaveAttribute("aria-selected", "true");
});

test("Tab leaves the tab list in one step", async ({ page }) => {
  await page.keyboard.press("Tab");
  await expect(tab(page, "Overview")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tab", { name: "Activity", exact: true })).not.toBeFocused();
});
