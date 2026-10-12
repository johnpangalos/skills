import { readFileSync } from "node:fs";
import { expect, type Locator } from "@playwright/test";

export type Region = { x: number; y: number; width: number; height: number };

/** A node as the figma-flow skill's export-node describes it: where it is and the values it is drawn with. */
export type FigmaNode = Region & {
  fill: string | null;
  stroke: string | null;
  strokeWeight: number;
  radius: number;
  rings: [color: string, spread: number][];
  label: {
    x: number;
    y: number;
    height: number;
    color: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
  } | null;
  /** Present when the node lays out two or more children. Padding is top, right, bottom, left. */
  layout?: { direction: "row" | "column"; gap: number; padding: [number, number, number, number] };
};

/**
 * Reads a file written by the figma-flow skill's export-node. Its last line is a hash of the rest, so a
 * copy that lost or changed a character throws here instead of testing against wrong numbers.
 */
export function loadFigmaNodes(url: URL): Record<string, FigmaNode> {
  const text = readFileSync(url, "utf8");
  const body = text.slice(0, text.lastIndexOf('  "hash"'));
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  const { variants, hash: expected } = JSON.parse(text);
  if (hash.toString(16) !== expected) {
    throw new Error(`${url.pathname} doesn't match its hash: export it from Figma again`);
  }
  return variants;
}

/**
 * Compares the values an element is drawn with against its Figma node, exactly: size, fill,
 * border, radius, focus rings, and the label's colour, type and position. Screenshots are
 * for a person or a model to look at; this is the part that can't be fuzzy.
 *
 * Two allowances. The box may be under a pixel off: Figma snaps a text box to whole pixels
 * and a browser doesn't, so anything that hugs text differs by a fraction. Colours may
 * differ by 1 of 255 per channel (rounding).
 *
 * Every comparison is soft: one run reports each value that differs, not only the first.
 *
 * Pass `width: false` where the width can't be compared: the element's text differs from the
 * Figma node's (a state variant labelled "Tab"), or it holds several text-hugging children,
 * whose fractions add up past a pixel.
 */
export async function expectToMatchFigma(element: Locator, figma: FigmaNode, { width = true } = {}) {
  const box = await element.boundingBox();
  expect(box, "element is not rendered").not.toBeNull(); // hard: nothing else can be measured
  for (const side of width ? (["width", "height"] as const) : (["height"] as const)) {
    expect.soft(
      Math.abs(box![side] - figma[side]),
      `${side} is ${box![side]}px, Figma's is ${figma[side]}px`,
    ).toBeLessThan(1);
  }

  const rendered = await element.evaluate((el) => {
    // Any CSS colour (oklch included) → "#rrggbb", or null when fully transparent.
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const hex = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return a === 0 ? null : "#" + [r!, g!, b!].map((c) => c.toString(16).padStart(2, "0")).join("");
    };
    const style = getComputedStyle(el);
    const border = parseFloat(style.borderTopWidth);
    // box-shadow layers that only spread are rings: [colour, spread], outermost first.
    const rings = style.boxShadow
      .split(/,(?![^(]*\))/)
      .map((layer) => layer.trim().match(/^(.+?) 0px 0px 0px (\d+)px$/))
      .flatMap((match) => (match && Number(match[2]) > 0 && hex(match[1]!) ? [[hex(match[1]!), Number(match[2])]] : []))
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    const px = (value: string) => parseFloat(value) || 0;
    return {
      layout: {
        direction: style.flexDirection.startsWith("column") ? "column" : "row",
        gap: px(style.flexDirection.startsWith("column") ? style.rowGap : style.columnGap),
        // Figma's padding is measured from the node's edge, so a border counts towards it.
        padding: (["Top", "Right", "Bottom", "Left"] as const).map(
          (side) => px(style[`padding${side}`]) + px(style[`border${side}Width`]),
        ),
      },
      fill: hex(style.backgroundColor),
      stroke: border > 0 ? hex(style.borderTopColor) : null,
      strokeWeight: border,
      radius: parseFloat(style.borderTopLeftRadius),
      rings,
      label: {
        x: parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
        y: parseFloat(style.paddingTop) + border,
        height: parseFloat(style.lineHeight),
        color: hex(style.color),
        fontSize: parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
        lineHeight: parseFloat(style.lineHeight),
      },
    };
  });

  const sameColor = (actual: unknown, expected: string | null, what: string) => {
    if (actual === null || expected === null) return expect.soft(actual, what).toBe(expected);
    const channels = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const drift = channels(actual as string).map((c, i) => Math.abs(c - channels(expected)[i]!));
    expect.soft(Math.max(...drift), `${what} is ${actual}, Figma's is ${expected}`).toBeLessThanOrEqual(1);
  };

  sameColor(rendered.fill, figma.fill, "fill");
  sameColor(rendered.stroke, figma.stroke, "border");
  expect.soft(rendered.strokeWeight, "border width").toBe(figma.strokeWeight);
  expect.soft(rendered.radius, "radius").toBe(figma.radius);
  // Figma can draw a ring another way (the ghost Button uses a rectangle), which this can't read.
  if (figma.rings.length > 0) {
    expect.soft(rendered.rings.map(([, spread]) => spread), "ring widths").toEqual(figma.rings.map(([, spread]) => spread));
    figma.rings.forEach(([color], i) => sameColor(rendered.rings[i]![0], color, `ring ${i + 1}`));
  }
  if (figma.layout) expect.soft(rendered.layout, "direction, gap and padding").toEqual(figma.layout);
  if (figma.label) {
    const { color, ...label } = figma.label;
    const { color: renderedColor, ...renderedLabel } = rendered.label;
    sameColor(renderedColor, color, "text colour");
    expect.soft(renderedLabel, "label position and type").toEqual(label);
  }
}
