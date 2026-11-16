import { test } from "@playwright/test";
import { expectPageToMatchFigma, loadFigmaPage } from "./figma";

// Page export of Figma node 3:311 (figma/report-an-injury.json): every key has an element.
const figma = loadFigmaPage(new URL("../figma/report-an-injury.json", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 772 });
  await page.goto("/report-an-injury");
  // Wait for the design's font, in every weight the page uses (400, 500, 600 at 14px and 18px).
  await page.evaluate(async () => {
    for (const font of ["400 14px Inter", "500 14px Inter", "600 14px Inter", "600 18px Inter"]) await document.fonts.load(font);
    await document.fonts.ready;
  });
});

test("Report an injury", async ({ page }) => {
  await expectPageToMatchFigma(figma, {
    "Report an injury": page.getByTestId("page"),
    "Report an injury > Card": page.getByTestId("card"),
    "Report an injury > Card > Header": page.getByTestId("header"),
    "Report an injury > Card > Header > Report an injury": page.getByRole("heading", { name: "Report an injury" }),
    "Report an injury > Card > Header > Step 1 of 3: what happened.": page.getByText("Step 1 of 3: what happened."),
    "Report an injury > Card > Date of injury": page.getByLabel("Date of injury").locator(".."),
    "Report an injury > Card > Body part": page.getByText("Body part", { exact: true }).locator(".."),
    "Report an injury > Card > What happened": page.getByLabel("What happened").locator(".."),
    "Report an injury > Card > Employer": page.getByLabel("Employer").locator(".."),
    "Report an injury > Card > Actions": page.getByTestId("actions"),
    "Report an injury > Card > Actions > Save draft": page.getByRole("button", { name: "Save draft" }),
    "Report an injury > Card > Actions > Continue": page.getByRole("button", { name: "Continue" }),
  });
});
