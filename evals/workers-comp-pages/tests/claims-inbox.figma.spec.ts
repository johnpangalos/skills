import { test } from "@playwright/test";
import { expectPageToMatchFigma, loadFigmaPage } from "./figma";

// figma/claims-inbox.json: the page export of node 4:194, every frame, text and instance under it.
const figma = loadFigmaPage(new URL("../figma/claims-inbox.json", import.meta.url));

test("Claims inbox matches Figma", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 579 });
  await page.goto("/claims-inbox");
  await page.evaluate(async () => {
    await document.fonts.load("14px Inter");
    await document.fonts.ready;
  });

  const rows = page.getByTestId("claim-row");
  const root = "Claims inbox";
  const content = `${root} > Content`;
  const header = `${content} > Header`;
  const filterKey = `${content} > Filters`;
  const claimsKey = `${content} > Claims`;

  // The Chip's radius is `calc(infinity * 1px)`, which Chromium reports as 33554400px; Figma's export says 9999.
  // Both draw a pill, but expectToMatchFigma compares the number exactly, and the Chip is the design system's.
  await expectPageToMatchFigma(figma, {
    [root]: page.getByTestId("page"),
    [content]: page.getByTestId("content"),
    [header]: page.getByTestId("header"),
    [`${header} > Claims`]: page.getByRole("heading", { name: "Claims" }),
    [`${header} > New claim`]: page.getByRole("button", { name: "New claim" }),
    // Three text-hugging tabs: Figma snaps each tab's text to whole pixels (61 + 71 + 65), a browser doesn't
    // (60.05 + 70.67 + 64.41), so the width sums to 211.1 against Figma's 213. Height, fill and radius are measured.
    [`${content} > TabList`]: { element: page.getByRole("tablist"), width: false },
    // Five text-hugging Chips in a row: Figma snaps each one's width to whole pixels and a browser
    // doesn't, so the row's width and the last Chip's x drift past a pixel (385.03 against 387, and
    // 301.6 against 303). Each Chip's own width is still compared.
    [filterKey]: { element: page.getByTestId("filters"), width: false },
    [`${filterKey} > All`]: page.getByRole("link", { name: "All", exact: true }),
    [`${filterKey} > Back`]: page.getByRole("link", { name: "Back", exact: true }),
    [`${filterKey} > Hand or wrist`]: page.getByRole("link", { name: "Hand or wrist", exact: true }),
    [`${filterKey} > Knee`]: page.getByRole("link", { name: "Knee", exact: true }),
    [`${filterKey} > Archived`]: { element: page.getByRole("link", { name: "Archived", exact: true }), position: false },
    [claimsKey]: page.getByTestId("claims"),
    [`${claimsKey} > WC-2041 · Lower back strain`]: rows.nth(0),
    [`${claimsKey} > WC-2038 · Wrist sprain`]: rows.nth(1),
    [`${claimsKey} > WC-2033 · Knee contusion`]: rows.nth(2),
    [`${claimsKey} > WC-2027 · Shoulder strain`]: rows.nth(3),
  });

});
