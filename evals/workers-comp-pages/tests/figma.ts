import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

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
  /**
   * Present when the node lays out two or more children. Padding is top, right, bottom, left.
   * `strokesIncludedInLayout`, recorded for a node with a stroke, says whether the padding starts
   * inside the stroke (true, as inside a CSS border) or at the node's edge (false or absent).
   */
  layout?: {
    direction: "row" | "column";
    gap: number;
    padding: [number, number, number, number];
    strokesIncludedInLayout?: boolean;
  };
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
  // JSON keeps only the last of two equal keys, so a repeated key would leave a node unmeasured
  // without a word. Exports from the current export-node number repeats; older ones may not.
  const written = [...body.matchAll(/^ {4}("(?:[^"\\]|\\.)*"):/gm)].map((match) => JSON.parse(match[1]!) as string);
  const repeated = written.filter((key, i) => written.indexOf(key) !== i);
  if (repeated.length > 0) {
    throw new Error(`${url.pathname} repeats ${[...new Set(repeated)].join(", ")}: export it again with the current figma-flow`);
  }
  return variants;
}

/** A text node on a page, as export-node describes it. */
export type FigmaText = Region & {
  id: string;
  type: "TEXT";
  parent: string;
  color: string | null;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  /** True when the text wraps to a set width; false when its box hugs the text. */
  wraps: boolean;
};

/** A frame or an instance on a page, as export-node describes it. */
export type FigmaPageBox = FigmaNode & {
  id: string;
  type: "FRAME" | "INSTANCE";
  parent: string | null;
  component?: string | null;
  variant?: string | null;
};

export type FigmaPageNode = FigmaPageBox | FigmaText;

/** Reads the export of a page: a frame exported with export-node, every frame and text under it. */
export function loadFigmaPage(url: URL): Record<string, FigmaPageNode> {
  const nodes = loadFigmaNodes(url) as unknown as Record<string, FigmaPageNode>;
  const notPage = Object.keys(nodes).filter((key) => !("parent" in nodes[key]!));
  if (notPage.length > 0) throw new Error(`${url.pathname} is not a page export (no parent on ${notPage[0]})`);
  return nodes;
}

/**
 * Compares a text element with its Figma text node: its size, colour and type. The element is
 * the one that holds the text itself (a heading, a paragraph, a span), not a box around it.
 *
 * Text that hugs its content may be under a pixel off in width, as with expectToMatchFigma; for
 * it to hug at all, its parent has to stop it stretching (`align-items: flex-start` in a column,
 * Figma's default). Pass `width: false` where the rendered text differs from Figma's.
 */
export async function expectTextToMatchFigma(element: Locator, figma: FigmaText, { width = true } = {}) {
  const box = await element.boundingBox();
  expect(box, "text is not rendered").not.toBeNull();
  for (const side of width ? (["width", "height"] as const) : (["height"] as const)) {
    expect.soft(Math.abs(box![side] - figma[side]), `${side} is ${box![side]}px, Figma's is ${figma[side]}px`).toBeLessThan(1);
  }
  const rendered = await element.evaluate((el) => {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    context.fillStyle = getComputedStyle(el).color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    const style = getComputedStyle(el);
    return {
      color: "#" + [r!, g!, b!].map((c) => c.toString(16).padStart(2, "0")).join(""),
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight),
      lineHeight: parseFloat(style.lineHeight),
    };
  });
  if (figma.color !== null) {
    const channels = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const drift = channels(rendered.color).map((c, i) => Math.abs(c - channels(figma.color!)[i]!));
    expect.soft(Math.max(...drift), `text colour is ${rendered.color}, Figma's is ${figma.color}`).toBeLessThanOrEqual(1);
  }
  const { color: _, ...type } = rendered;
  expect.soft(type, "font size, weight and line height").toEqual({
    fontSize: figma.fontSize,
    fontWeight: figma.fontWeight,
    lineHeight: figma.lineHeight ?? type.lineHeight,
  });
}

/** Leaves an entry of a page export unmeasured, with the reason; the report lists it. */
export const skip = (reason: string) => ({ skip: reason });

type Located = Locator | { skip: string } | { element: Locator; width?: false; position?: false };

/**
 * Measures a whole page export. `locate` maps every key of the export to its element, or to
 * `skip("why")`; a key missing from it fails the test, so nothing goes unmeasured by accident.
 *
 * Each frame and instance is compared with expectToMatchFigma, each text with
 * expectTextToMatchFigma, and each one's position with its parent's: the offset of its box from
 * its parent's box against Figma's x and y, under a pixel, as sizes are. A parent that is
 * skipped passes the offset on to its own parent. Pass `{ element, position: false }` where an
 * offset can't be compared, such as after several text-hugging siblings in a row, whose
 * fractions of a pixel add up.
 */
export async function expectPageToMatchFigma(nodes: Record<string, FigmaPageNode>, locate: Record<string, Located>) {
  const missing = Object.keys(nodes).filter((key) => !(key in locate));
  const extra = Object.keys(locate).filter((key) => !(key in nodes));
  expect(missing, "entries of the export with no element and no skip()").toEqual([]);
  expect(extra, "keys that aren't in the export").toEqual([]);

  const elementOf = (key: string) => {
    const where = locate[key]!;
    if ("skip" in where) return null;
    if ("element" in where) return where.element;
    return where;
  };
  for (const [key, node] of Object.entries(nodes)) {
    const where = locate[key]!;
    if ("skip" in where) {
      test.info().annotations.push({ type: "figma: not measured", description: `${key}: ${where.skip}` });
      continue;
    }
    const element = elementOf(key)!;
    const options: { width?: false; position?: false } = "element" in where ? where : {};
    await test.step(key, async () => {
      if (node.type === "TEXT") await expectTextToMatchFigma(element, node, { width: options.width ?? true });
      else await expectToMatchFigma(element, node, { width: options.width ?? true });
      if (node.parent === null || options.position === false) return;
      // The nearest measured ancestor, and this node's offset from it in Figma.
      let parent: string | null = node.parent;
      let x = node.x;
      let y = node.y;
      while (parent !== null && elementOf(parent) === null) {
        x += nodes[parent]!.x;
        y += nodes[parent]!.y;
        parent = nodes[parent]!.parent;
      }
      if (parent === null) return;
      const [box, parentBox] = await Promise.all([element.boundingBox(), elementOf(parent)!.boundingBox()]);
      if (!box || !parentBox) return; // expectToMatchFigma has already failed on a missing box
      expect.soft(Math.abs(box.x - parentBox.x - x), `x in ${parent} is ${box.x - parentBox.x}px, Figma's is ${x}px`).toBeLessThan(1);
      expect.soft(Math.abs(box.y - parentBox.y - y), `y in ${parent} is ${box.y - parentBox.y}px, Figma's is ${y}px`).toBeLessThan(1);
    });
  }
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
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    return {
      layout: {
        direction: style.flexDirection.startsWith("column") ? "column" : "row",
        gap: px(style.flexDirection.startsWith("column") ? style.rowGap : style.columnGap),
        padding: sides.map((side) => px(style[`padding${side}`])),
      },
      borders: sides.map((side) => px(style[`border${side}Width`])),
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
  if (figma.layout) {
    const { strokesIncludedInLayout, ...layout } = figma.layout;
    let padding = rendered.layout.padding;
    // With the stroke out of the layout (Figma's default), Figma's padding is measured from the
    // node's edge, so the CSS border counts towards it. With it in, both start inside the border.
    if (!strokesIncludedInLayout) padding = padding.map((side, i) => side + rendered.borders[i]!);
    expect.soft({ ...rendered.layout, padding }, "direction, gap and padding").toEqual(layout);
  }
  if (figma.label) {
    const { color, ...label } = figma.label;
    const { color: renderedColor, ...renderedLabel } = rendered.label;
    sameColor(renderedColor, color, "text colour");
    expect.soft(renderedLabel, "label position and type").toEqual(label);
  }
}
