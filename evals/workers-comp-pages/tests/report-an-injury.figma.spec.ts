import { test } from "@playwright/test";
import { expectPageToMatchFigma, loadFigmaPage, skip } from "./figma";

// figma/report-an-injury.json: every frame and text under the page frame (3:311), and one entry per
// component instance (the four fields and the two Buttons), whose insides belong to @workers-comp/ui.
const figma = loadFigmaPage(new URL("../figma/report-an-injury.json", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 772 });
  await page.goto("/report-an-injury");
  await page.evaluate(async () => {
    await document.fonts.load("14px Inter");
    await document.fonts.ready;
  });
});

test("Report an injury page", async ({ page }) => {
  const header = page.getByTestId("header");
  await expectPageToMatchFigma(figma, {
    "Report an injury": page.getByTestId("page"),
    "Report an injury > Card": page.getByTestId("card"),
    "Report an injury > Card > Header": header,
    "Report an injury > Card > Header > Report an injury": header.getByRole("heading", { name: "Report an injury" }),
    "Report an injury > Card > Header > Step 1 of 3: what happened.": header.getByText("Step 1 of 3: what happened."),
    "Report an injury > Card > Date of injury": page.locator(".report-field").nth(0),
    "Report an injury > Card > Body part": page.locator(".report-field").nth(1),
    "Report an injury > Card > What happened": page.locator(".report-field").nth(2),
    "Report an injury > Card > Employer": page.locator(".report-field").nth(3),
    "Report an injury > Card > Actions": page.getByTestId("actions"),
    "Report an injury > Card > Actions > Save draft": page.getByRole("button", { name: "Save draft" }),
    "Report an injury > Card > Actions > Continue": page.getByRole("button", { name: "Continue" }),
  });
});
