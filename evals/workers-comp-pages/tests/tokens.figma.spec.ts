import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Template: Figma's variables must not drift from the CSS the app draws with. For every variable in
// the token snapshot (tokens.json in the exports folder, from figma-flow's export-tokens), its WEB
// code syntax (`var(--color-gray-900)`, `calc(var(--spacing) * 4)`) is resolved in the running app
// and compared with Figma's value. It reads whatever defines the custom properties: a design
// system package's CSS, a Tailwind theme, the app's own. Replace the two placeholders: the path to
// tokens.json, and a page whose CSS includes the app's global styles.
//
// Text and effect styles aren't compared here: a text style is its size, line-height and weight
// variables, which are; an effect style often has no variable at all (the mapping says what then).
type Variable = { value: string | number | boolean; web: string | null };
const { textStyles: _text, effectStyles: _effects, ...collections } = JSON.parse(
  readFileSync(new URL("../figma/tokens.json", import.meta.url), "utf8"),
) as Record<string, Record<string, Variable>>;
const variables = Object.entries(collections).flatMap(([collection, entries]) =>
  Object.entries(entries).map(([name, variable]) => ({ name: `${collection}: ${name}`, ...variable })),
);

test("every Figma variable resolves in the app to Figma's value", async ({ page }) => {
  await page.goto("/");
  const resolved = await page.evaluate((all) => {
    const root = getComputedStyle(document.documentElement);
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const hex = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return "#" + [r!, g!, b!].map((c) => c.toString(16).padStart(2, "0")).join("");
    };
    return all.map(({ name, value, web }) => {
      if (web === null) return { name, problem: "has no WEB code syntax in Figma" };
      // A line height is resolved with its font size (below), so that one has to be defined too.
      const lineHeight = web.match(/^var\((--[\w-]+)--line-height\)$/);
      const used = `${web} ${lineHeight ? `var(${lineHeight[1]})` : ""}`;
      const undefinedProps = [...used.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]!).filter((p) => root.getPropertyValue(p).trim() === "");
      if (undefinedProps.length > 0) return { name, problem: `${web}: the app's CSS doesn't define ${undefinedProps.join(", ")}` };
      const probe = document.createElement("div");
      document.body.append(probe);
      // A value CSS rejects for the property leaves it unset: report that, not a false drift.
      const set = (property: "color" | "fontWeight" | "fontFamily" | "fontSize" | "lineHeight" | "width", css: string) => {
        probe.style[property] = css;
        return probe.style[property] !== "";
      };
      const rejected = (as: string) => ({ name, problem: `${web} isn't a valid ${as}; compare it by hand` });
      try {
        if (typeof value === "string" && value.startsWith("#")) {
          if (!set("color", web)) return rejected("colour");
          return { name, value, actual: hex(getComputedStyle(probe).color), kind: "color" };
        }
        if (/--font-weight-/.test(web)) {
          if (!set("fontWeight", web)) return rejected("font weight");
          return { name, value, actual: Number(getComputedStyle(probe).fontWeight), kind: "exact" };
        }
        if (typeof value === "string") {
          // A font family: Figma names one family, CSS a stack that starts with it.
          if (!set("fontFamily", web)) return rejected("font family");
          return { name, value, actual: getComputedStyle(probe).fontFamily.split(",")[0]!.replaceAll(/["']/g, "").trim(), kind: "exact" };
        }
        if (lineHeight) {
          // Often a ratio of its font size (`calc(1.25 / 0.875)`), so it's resolved with that size.
          if (!set("fontSize", `var(${lineHeight[1]})`) || !set("lineHeight", web)) return rejected("line height");
          return { name, value, actual: parseFloat(getComputedStyle(probe).lineHeight), kind: "length" };
        }
        if (!set("width", web)) return rejected("length"); // a bare ratio, say
        return { name, value, actual: parseFloat(getComputedStyle(probe).width), kind: "length" };
      } finally {
        probe.remove();
      }
    });
  }, variables);

  for (const result of resolved) {
    if ("problem" in result) {
      expect.soft(result.problem, result.name).toBe("");
      continue;
    }
    const { name, value, actual, kind } = result;
    if (kind === "color") {
      // An OKLCH palette and Figma's hex equivalents round differently, so allow 2 of 255.
      const channels = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
      const drift = channels(actual as string).map((c, i) => Math.abs(c - channels(value as string)[i]!));
      expect.soft(Math.max(...drift), `${name}: Figma ${value}, the app ${actual}`).toBeLessThanOrEqual(2);
    } else if (kind === "length" && (value as number) >= 9999) {
      // `calc(infinity * 1px)` for a full radius: any huge value is the same drawing.
      expect.soft(actual as number, `${name}: Figma ${value}, the app ${actual}px`).toBeGreaterThanOrEqual(9999);
    } else if (kind === "length") {
      expect.soft(Math.abs((actual as number) - (value as number)), `${name}: Figma ${value}, the app ${actual}px`).toBeLessThan(0.01);
    } else {
      expect.soft(actual, `${name}: Figma ${value}, the app ${actual}`).toBe(value);
    }
  }
});
