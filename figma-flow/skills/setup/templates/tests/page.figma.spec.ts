import { test } from "@playwright/test";
import { expectPageToMatchFigma, loadFigmaPage, skip } from "./figma";

// Template for a page export: a frame exported with figma-flow's export-node, which gives an entry
// for every frame and text under it and one per library instance. Rename the file after the page,
// point the paths at the export and the page, set the viewport to the frame's size, and give every
// key of the export an element, or skip("why") for one the helper can't read. A key with neither
// fails, so nothing goes unmeasured by accident.
//
// The keys are the export's own: copy them from the export file, never retype them.
const figma = loadFigmaPage(new URL("<PATH TO EXPORT>.json", import.meta.url));

test.beforeEach(async ({ page }) => {
  // The page frame's width and height from the export's first entry.
  await page.setViewportSize({ width: <WIDTH>, height: <HEIGHT> });
  await page.goto("<PAGE URL>");
  // Wait for the design's font; before it loads, text has the fallback font's width.
  await page.evaluate(async () => {
    await document.fonts.load("<SIZE>px <FAMILY>");
    await document.fonts.ready;
  });
});

test("<PAGE NAME>", async ({ page }) => {
  // Prefer roles, labels and text; a data-testid on a layout frame works too.
  await expectPageToMatchFigma(figma, {
    "<PAGE NAME>": page.getByTestId("page"),
    "<PAGE NAME> > Card": page.getByTestId("card"),
    "<PAGE NAME> > Card > Title": page.getByRole("heading", { name: "Title" }),
    "<PAGE NAME> > Card > Continue": page.getByRole("button", { name: "Continue" }),
    // An entry the helper can't read, with the reason; the report lists it.
    "<PAGE NAME> > Card > Divider": skip("a vector: the helper reads frames, instances and text"),
  });
});
