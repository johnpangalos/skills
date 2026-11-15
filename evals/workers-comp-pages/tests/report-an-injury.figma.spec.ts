import { test } from "@playwright/test";
import { expectToMatchFigma, loadFigmaNodes } from "./figma";

// figma/report-an-injury.json: the page frame, the Card, its Header, the four fields, the Actions row,
// the two Buttons, and each field's direct children. See runs/figma-flow-report-an-injury.md for what
// it leaves out (text-only nodes, the chevron, the shadow, and entries that share a key).
const figma = loadFigmaNodes(new URL("../figma/report-an-injury.json", import.meta.url));
const node = (key: string) => {
  const found = figma[key];
  if (!found) throw new Error(`no "${key}" in the export`);
  return found;
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 772 });
  await page.goto("/report-an-injury");
});

test("page and card", async ({ page }) => {
  await expectToMatchFigma(page.getByTestId("page"), node("Report an injury"));
  await expectToMatchFigma(page.getByTestId("card"), node("Card"));
  await expectToMatchFigma(page.getByTestId("header"), node("Header"));
  await expectToMatchFigma(page.getByTestId("actions"), node("Actions"));
});

test("Date of injury TextField", async ({ page }) => {
  await expectToMatchFigma(page.locator(".report-field").nth(0), node("TextField"));
  await expectToMatchFigma(page.getByText("Date of injury"), node("TextField > Date of injury"));
  await expectToMatchFigma(page.getByPlaceholder("YYYY-MM-DD"), node("TextField > YYYY-MM-DD"));
  await expectToMatchFigma(
    page.getByText("The day it happened, even if you reported it later."),
    node("TextField > The day it happened, even if you reported it later."),
  );
});

test("Body part Select, invalid", async ({ page }) => {
  await expectToMatchFigma(page.locator(".report-field").nth(1), node("Select"));
  await expectToMatchFigma(page.getByRole("button", { name: /Body part/ }), node("Select > Select a body part"));
});

test("What happened TextArea", async ({ page }) => {
  await expectToMatchFigma(page.locator(".report-field").nth(2), node("TextArea"));
  await expectToMatchFigma(
    page.getByPlaceholder("What happened, and how were you hurt?"),
    node("TextArea > What happened, and how were you hurt?"),
  );
});

test("Employer TextField, disabled", async ({ page }) => {
  await expectToMatchFigma(page.locator(".report-field").nth(3), node("TextField"));
  // The Employer label is not measured: its export entry shares the key "TextField > Employer" with the
  // input's, so the JSON object keeps only the input's.
  await expectToMatchFigma(page.getByPlaceholder("Employer"), node("TextField > Employer"));
  await expectToMatchFigma(page.getByText("Set by your employer's policy."), node("TextField > Set by your employer's policy."));
});

test("Buttons", async ({ page }) => {
  await expectToMatchFigma(page.getByRole("button", { name: "Save draft" }), node("Actions > Save draft"));
  await expectToMatchFigma(page.getByRole("button", { name: "Continue" }), node("Actions > Continue"));
});
