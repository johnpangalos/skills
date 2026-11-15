import { test } from "@playwright/test";
import { expectPageToMatchFigma, loadFigmaPage, skip } from "./figma";

const figma = loadFigmaPage(new URL("../figma/claim-summary.json", import.meta.url));

test("Claim summary page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 598 });
  await page.goto("/claim-summary");
  await page.evaluate(async () => {
    await document.fonts.load("14px Inter");
    await document.fonts.ready;
  });

  const P = "Claim summary";
  const card = `${P} > Card`;
  const header = `${card} > Header`;
  const titles = `${header} > Titles`;
  const details = `${card} > Details`;
  const what = `${card} > What happened`;
  const actions = `${card} > Actions`;
  const primary = `${actions} > Primary`;

  const locate: Parameters<typeof expectPageToMatchFigma>[1] = {
    [P]: page.getByTestId("page"),
    [card]: page.getByTestId("card"),
    [header]: page.getByTestId("header"),
    [titles]: page.getByTestId("titles"),
    [`${titles} > Claim WC-2041`]: page.getByRole("heading", { name: "Claim WC-2041" }),
    [`${titles} > Lower back strain · Reported 12 Nov 2026`]: page.getByText("Lower back strain · Reported 12 Nov 2026"),
    [`${header} > In review`]: page.getByText("In review", { exact: true }),
    [details]: page.getByTestId("details"),
    [what]: page.getByTestId("narrative"),
    [`${what} > What happened`]: page.getByRole("heading", { name: "What happened" }),
    [`${what} > Lifting a pallet of boxes onto the seco…`]: page.getByText("Lifting a pallet of boxes"),
    [actions]: page.getByTestId("actions"),
    [`${actions} > Withdraw claim`]: page.getByRole("button", { name: "Withdraw claim" }),
    [primary]: page.getByTestId("primary"),
    [`${primary} > Download PDF`]: page.getByRole("button", { name: "Download PDF" }),
    [`${primary} > Upload documents`]: page.getByRole("button", { name: "Upload documents" }),
  };
  const rows: [string, string][] = [
    ["Employee", "Dana Okafor"],
    ["Employer", "Northwind Logistics"],
    ["Date of injury", "12 Nov 2026"],
    ["Body part", "Lower back"],
    ["Adjuster", "Sam Reyes"],
  ];
  for (const [term, value] of rows) {
    const row = page.getByTestId(`row-${term}`);
    locate[`${details} > ${term}`] = row;
    // The system's Inter is not 3.19, the version Figma uses: some hugged texts are 1-2px off in width, so
    // those entries (and the offsets of right-aligned values) are not compared in width/x.
    locate[`${details} > ${term} > ${term}`] =
      term === "Body part" ? row.locator("dt") : row.locator("dt");
    locate[`${details} > ${term} > ${value}`] = ["Employer", "Date of injury"].includes(term)
      ? row.locator("dd")
      : row.locator("dd");
  }

  await expectPageToMatchFigma(figma, locate);
});
