// Template (Tailwind v4 + Vitest): put this next to the project's Tailwind theme file and fix
// the three paths below. `ourTheme` is the CSS file holding the project's `@theme` block; if
// the project has none, import an empty string instead.
import tokens from "../figma/tokens.json?raw";
import tailwindTheme from "tailwindcss/theme.css?raw";
import ourTheme from "./theme.css?raw";

/**
 * Figma must not drift from the Tailwind theme. figma/tokens.json is a snapshot of the
 * Figma file's variables and styles (refresh it with figma/export-tokens.ts); every one
 * has to resolve to a token in the theme the components are compiled against, with the
 * same value. A Figma variable that isn't a Tailwind default fails here until it is added
 * to the project's `@theme` block under the same name.
 */
type Variable = { value: string | number; web: string | null };
type Shadow = { x: number; y: number; blur: number; spread: number; color: string; alpha: number };
const { textStyles, effectStyles, ...collections } = JSON.parse(tokens) as {
  textStyles: Record<string, { family: string; style: string; size: number; lineHeight: number }>;
  effectStyles: Record<string, Shadow[]>;
} & Record<string, Record<string, Variable>>;
const variables = Object.values(collections).flatMap((collection) => Object.entries(collection));

// Tailwind's defaults, then our overrides: name → value, as written in the CSS.
const theme = new Map<string, string>();
for (const css of [tailwindTheme, ourTheme]) {
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    theme.set(name!, value!.trim().replace(/\s+/g, " "));
  }
}

const px = (value: string) => (value.endsWith("rem") ? parseFloat(value) * 16 : parseFloat(value));

// CSS Color 4: oklch → sRGB, as 0–255 channels.
function rgb(color: string): number[] {
  if (color.startsWith("#")) {
    const hex = color.length === 4 ? color.replace(/[\da-f]/gi, "$&$&") : color;
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const [l = 0, c = 0, h = 0] = color.match(/[\d.]+/g)!.map(Number);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const [L = 0, M = 0, S = 0] = [
    l / 100 + 0.3963377774 * a + 0.2158037573 * b,
    l / 100 - 0.1055613458 * a - 0.0638541728 * b,
    l / 100 - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3);
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((linear) => {
    const v = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
}

describe("Figma variables", () => {
  it.each(variables)("%s is a theme token with the same value", (name, { value, web }) => {
    expect(web, "no WEB code syntax in Figma").toBeTruthy();

    const spacing = web!.match(/^calc\(var\(--spacing\) \* ([\d.]+)\)$/);
    if (spacing) {
      expect(px(theme.get("--spacing")!) * Number(spacing[1])).toBe(value);
      return;
    }
    if (web === "1px") return expect(value).toBe(1);
    if (web === "calc(infinity * 1px)") return expect(value).toBeGreaterThanOrEqual(9999);

    const token = web!.match(/^var\((--[\w-]+)\)$/)?.[1];
    expect(token, `${web} is not a theme variable`).toBeTruthy();
    const themed = theme.get(token!);
    expect(themed, `${token} is not in the theme: add it to src/theme.css`).toBeDefined();

    if (token!.startsWith("--color-")) {
      // Tailwind's palette is OKLCH and Figma holds the hex equivalents, so allow rounding.
      const figma = rgb(value as string);
      const drift = rgb(themed!).map((channel, i) => Math.abs(channel - figma[i]!));
      expect(Math.max(...drift), `Figma ${value}, theme ${themed}`).toBeLessThanOrEqual(2);
    } else if (token!.startsWith("--font-weight-")) {
      expect(Number(themed)).toBe(value);
    } else if (token!.startsWith("--font-")) {
      expect(themed!.split(",")[0]!.replaceAll(/["']/g, "")).toBe(value);
    } else if (token!.endsWith("--line-height")) {
      // Tailwind writes line heights as a ratio of the font size: `calc(1.25 / 0.875)` or `1`.
      const [top = 1, bottom = 1] = themed!.match(/[\d.]+/g)!.map(Number);
      const fontSize = px(theme.get(token!.replace("--line-height", ""))!);
      expect((top / bottom) * fontSize).toBeCloseTo(value as number, 5);
    } else {
      expect(px(themed!)).toBe(value);
    }
  });
});

describe("Figma styles", () => {
  // "text-sm/semibold" is the utilities `text-sm font-semibold`.
  it.each(Object.entries(textStyles))("%s is a text size and a font weight", (name, style) => {
    const [size, weight] = name.split("/") as [string, string];
    expect(px(theme.get(`--${size}`)!)).toBe(style.size);
    expect(variables.find(([n]) => n === `${size.replace("-", "/")}--line-height`)?.[1].value).toBe(
      style.lineHeight,
    );
    const weights: Record<string, string> = { Regular: "400", Medium: "500", "Semi Bold": "600", Bold: "700" };
    expect(theme.get(`--font-weight-${weight}`)).toBe(weights[style.style]);
    expect(theme.get("--font-sans")).toContain(style.family);
  });

  // "shadow-md" is the utility `shadow-md`: the same layers as --shadow-md.
  it.each(Object.entries(effectStyles))("%s is the theme's shadow", (name, layers) => {
    const themed = theme.get(`--${name}`)!.split(/,\s*/).map((layer) => {
      const [lengths = "", colour = ""] = layer.split(" rgb(");
      const [x, y, blur = 0, spread = 0] = lengths.split(" ").map(parseFloat);
      const [r = 0, g = 0, b = 0, alpha] = colour.match(/[\d.]+/g)!.map(Number);
      const color = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
      return { type: "DROP_SHADOW", x, y, blur, spread, color, alpha };
    });
    expect(layers).toEqual(themed);
  });
});
