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
  const claims = [
    ["WC-2041 · Lower back strain", "Reported 12 Nov 2026 · Warehouse", "In review"],
    ["WC-2038 · Wrist sprain", "Reported 3 Nov 2026 · Loading dock", "Approved"],
    ["WC-2033 · Knee contusion", "Reported 28 Oct 2026 · Yard", "Needs info"],
    ["WC-2027 · Shoulder strain", "Reported 19 Oct 2026 · Warehouse", "Denied"],
  ];

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
    // Each ClaimRow, which the app builds, with what's inside it: its Info column, both lines of
    // text and its Badge.
    ...Object.fromEntries(
      claims.flatMap(([title, meta, status], i) => {
        const key = `${claimsKey} > ${title}`;
        const row = rows.nth(i);
        return [
          [key, row],
          [`${key} > Info`, row.locator(".claim-row-info")],
          [`${key} > Info > ${title}`, row.getByText(title, { exact: true })],
          [`${key} > Info > ${meta}`, row.getByText(meta, { exact: true })],
          [`${key} > ${status}`, row.getByText(status, { exact: true })],
        ];
      }),
    ),
  });
});
