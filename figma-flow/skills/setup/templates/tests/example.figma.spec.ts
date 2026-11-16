import { expect, test } from "@playwright/test";
import { expectToMatchFigma, loadFigmaNodes } from "./figma";

// Template: one test per entry in an export. Rename the file after the component, point the
// two paths at the export and the page, and replace the locator and the states with this
// component's own. The page doesn't have to look like the Figma file: it only has to render
// every variant where the test can find it.
const nodes = loadFigmaNodes(new URL("<PATH TO EXPORT>.json", import.meta.url));

for (const [name, node] of Object.entries(nodes)) {
  // A variant's name lists its properties: "variant=outline, size=sm, state=hover".
  const props = Object.fromEntries(name.split(", ").map((pair) => pair.split("=")));

  test(name, async ({ page }) => {
    await page.goto("<PAGE URL>");
    await page.addStyleTag({ content: "* { transition: none !important; }" });
    // Wait for the design's font; before it loads, text has the fallback font's width.
    await page.evaluate(() => document.fonts.load("<WEIGHT> <SIZE>px <FAMILY>"));
    await page.mouse.move(0, 0); // off every element, so nothing is hovered

    // Find the element for this variant. Prefer roles and labels; data attributes work too.
    const element = page.locator(`[data-variant="${props.variant}"][data-size="${props.size}"]`).first();

    // Put it in the Figma state the way a person would.
    if (props.state === "hover" || props.state === "active") await element.hover();
    if (props.state === "active") await page.mouse.down();
    if (props.state === "focus") {
      await page.keyboard.press("Tab"); // keyboard focus, so a focus ring shows
      await element.focus();
    }
    if (props.state === "disabled") await expect(element).toBeDisabled();

    // Pass { width: false } when the element's text differs from the Figma node's, or when it
    // holds several text-hugging children.
    await expectToMatchFigma(element, node);
  });
}
