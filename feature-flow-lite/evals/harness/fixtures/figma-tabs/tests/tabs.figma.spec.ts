import { expect, test, type Page } from "@playwright/test";
import { expectToMatchFigma, loadFigmaNodes } from "./figma";

// The Figma Tabs design against the rendered page: the values each part is drawn with, exactly.
const figma = loadFigmaNodes(new URL("../figma/tabs.json", import.meta.url));
const node = (name: string) => {
  const found = figma[name];
  if (!found) throw new Error(`figma/tabs.json has no "${name}"`);
  return found;
};

async function open(page: Page) {
  await page.goto("/");
  await page.addStyleTag({ content: "* { transition: none !important; }" });
  // Wait for the fonts; before they load, text has the fallback font's width.
  await page.evaluate(() => Promise.all([document.fonts.load("500 14px Inter"), document.fonts.load("400 14px Inter")]));
  await page.mouse.move(600, 500); // off the tabs, so nothing is hovered
}
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });

test("Tabs: the list above the panel", async ({ page }) => {
  await open(page);
  // The root is the tablist's parent. It may stretch to its container, so its width isn't compared.
  await expectToMatchFigma(page.getByRole("tablist").locator(".."), node("Tabs"), { width: false });
});

test("TabList: the track", async ({ page }) => {
  await open(page);
  // Three text-hugging tabs: their fractions of a pixel add up, so the width isn't compared.
  await expectToMatchFigma(page.getByRole("tablist"), node("TabList"), { width: false });
});

for (const name of ["Overview", "Activity", "Settings"]) {
  test(`TabList > ${name}`, async ({ page }) => {
    await open(page);
    if (name === "Settings") await expect(tab(page, name)).toBeDisabled();
    await expectToMatchFigma(tab(page, name), node(`TabList > ${name}`));
  });
}

// The state variants are labelled "Tab" in Figma, so their width isn't compared.
test("Tab/selected=false, state=default", async ({ page }) => {
  await open(page);
  await expectToMatchFigma(tab(page, "Activity"), node("Tab/selected=false, state=default"), { width: false });
});

test("Tab/selected=false, state=hover", async ({ page }) => {
  await open(page);
  await tab(page, "Activity").hover();
  await expectToMatchFigma(tab(page, "Activity"), node("Tab/selected=false, state=hover"), { width: false });
});

test("Tab/selected=false, state=disabled", async ({ page }) => {
  await open(page);
  await tab(page, "Settings").hover({ force: true }); // hovering a disabled tab changes nothing
  await expectToMatchFigma(tab(page, "Settings"), node("Tab/selected=false, state=disabled"), { width: false });
});

test("Tab/selected=true, state=default", async ({ page }) => {
  await open(page);
  await expectToMatchFigma(tab(page, "Overview"), node("Tab/selected=true, state=default"), { width: false });
});

test("Tab/selected=true, state=focus", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab"); // keyboard focus lands on the selected tab and shows the ring
  await expect(tab(page, "Overview")).toBeFocused();
  await expectToMatchFigma(tab(page, "Overview"), node("Tab/selected=true, state=focus"), { width: false });
});

test("TabPanel", async ({ page }) => {
  await open(page);
  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveText("Overview panel");
  // A panel may stretch to its container, so its width isn't compared.
  await expectToMatchFigma(panel, node("TabPanel"), { width: false });
});
