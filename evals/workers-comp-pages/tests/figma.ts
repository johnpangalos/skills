import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

export type Region = { x: number; y: number; width: number; height: number };

/** A shadow with a blur. Its colour is "#rrggbb", or "#rrggbbaa" when its alpha is below 1, as every colour in an export is. */
export type Shadow = { x: number; y: number; blur: number; spread: number; color: string; inset: boolean };

/**
 * The typography of a label or a text. An older export has none of these; a value is null where
 * Figma's is mixed (its runs differ), and a field that is null or absent isn't compared.
 */
export type Typography = {
  fontFamily?: string | null;
  letterSpacing?: number | null;
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize" | "small-caps" | null;
  textDecoration?: "none" | "underline" | "line-through" | null;
  /** Only for text that wraps to a set width. */
  textAlign?: "left" | "center" | "right" | "justify";
};

/** A node as the figma-flow skill's export-node describes it: where it is and the values it is drawn with. */
export type FigmaNode = Region & {
  /** The node's own opacity. Absent from an older export, which isn't compared. */
  opacity?: number;
  fill: string | null;
  stroke: string | null;
  /** One width, or [top, right, bottom, left] when the sides differ. 0 with no stroke. */
  strokeWeight: number | [number, number, number, number];
  /** Where the stroke sits: inside (a CSS border), outside (an outline), or centred (CSS can't draw it). */
  strokeAlign?: "inside" | "outside" | "center";
  /** True for a dashed stroke; absent for a solid one. */
  dashed?: true;
  /**
   * One radius, or [top-left, top-right, bottom-right, bottom-left] when the corners differ. Null
   * is an older export's word for corners that differ, which it can't describe.
   */
  radius: number | [number, number, number, number] | null;
  rings: [color: string, spread: number][];
  /** Shadows with a blur, in the order CSS lists them: what isn't a ring. */
  shadows?: Shadow[];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  label: ({
    x: number;
    y: number;
    height: number;
    color: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
  } & Typography) | null;
  /**
   * Present when the node lays out two or more children. Padding is top, right, bottom, left.
   * `strokesIncludedInLayout`, recorded for a node with a stroke, says whether the padding starts
   * inside the stroke (true, as inside a CSS border) or at the node's edge (false or absent).
   * `justify` and `align` are left out when the children fill that axis; `wrap` and `rowGap` are
   * for a layout whose children wrap onto more lines.
   */
  layout?: {
    direction: "row" | "column";
    gap: number;
    padding: [number, number, number, number];
    strokesIncludedInLayout?: boolean;
    justify?: "start" | "center" | "end" | "space-between";
    align?: "start" | "center" | "end" | "baseline";
    wrap?: true;
    rowGap?: number;
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
export type FigmaText = Region &
  Typography & {
    id: string;
    type: "TEXT";
    parent: string;
    color: string | null;
    fontSize: number;
    fontWeight: number;
    lineHeight: number | null;
    /** True when the text wraps to a set width; false when its box hugs the text. */
    wraps: boolean;
    opacity?: number;
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

/** A value for all four sides or corners: one number, or the four in order. */
function fourOf<T>(value: T | [T, T, T, T]): [T, T, T, T] {
  if (Array.isArray(value)) return value as [T, T, T, T];
  return [value as T, value as T, value as T, value as T];
}

/** The CSS style a line is drawn in. */
function lineStyle(dashed: true | undefined) {
  if (dashed) return "dashed" as const;
  return "solid" as const;
}

/** A shadow's geometry, without its colour (compared channel by channel). */
const shadowShape = ({ x, y, blur, spread, inset }: Shadow) => ({ x, y, blur, spread, inset });

/**
 * Two colours, each channel within 1 of 255. An 8-digit colour (with alpha) against an opaque one is a
 * mismatch, even when its alpha rounds to 255.
 */
function expectSameColor(actual: string | null, expected: string | null, what: string) {
  if (actual === null || expected === null) {
    expect.soft(actual, what).toBe(expected);
    return;
  }
  const channels = (color: string) =>
    [1, 3, 5, 7].slice(0, 3 + Number(color.length === 9)).map((i) => parseInt(color.slice(i, i + 2), 16));
  const [rendered, figma] = [channels(actual), channels(expected)];
  if (rendered.length !== figma.length) {
    expect.soft(actual, `${what} is ${actual}, Figma's is ${expected}`).toBe(expected);
    return;
  }
  const drift = rendered.map((c, i) => Math.abs(c - figma[i]!));
  expect.soft(Math.max(...drift), `${what} is ${actual}, Figma's is ${expected}`).toBeLessThanOrEqual(1);
}

/**
 * Compares each value Figma has with the rendered one. A value that is absent or null isn't
 * compared. Opacity and letter spacing are rounded by Figma, so they get a tolerance.
 */
const tolerance: Record<string, number> = { opacity: 0.005, letterSpacing: 0.01 };
function expectFields(rendered: object, figma: object, what: string) {
  for (const [key, expected] of Object.entries(figma)) {
    if (expected === null || expected === undefined) continue;
    const actual = (rendered as Record<string, unknown>)[key];
    if (key in tolerance) {
      expect
        .soft(Math.abs((actual as number) - (expected as number)), `${what}: ${key} is ${actual}, Figma's is ${expected}`)
        .toBeLessThan(tolerance[key]!);
    } else {
      expect.soft(actual, `${what}: ${key}`).toEqual(expected);
    }
  }
}

/**
 * Compares a text element with its Figma text node: its size, colour, type and opacity. The element is
 * the one that holds the text itself (a heading, a paragraph, a span), not a box around it.
 *
 * Text that hugs its content may be under a pixel off in width, as with expectToMatchFigma; for
 * it to hug at all, its parent has to stop it stretching (`align-items: flex-start` in a column,
 * Figma's default). Pass `width: false` only where the words differ from Figma's (sample data in
 * place of the design's). A width that is off because the font differs is a failure to report:
 * the app isn't drawing the design's font, and turning the check off hides it.
 */
export async function expectTextToMatchFigma(element: Locator, figma: FigmaText, { width = true } = {}) {
  const box = await element.boundingBox();
  expect(box, "text is not rendered").not.toBeNull();
  const measured: ("width" | "height")[] = ["height"];
  if (width) measured.unshift("width");
  for (const side of measured) {
    expect.soft(Math.abs(box![side] - figma[side]), `${side} is ${box![side]}px, Figma's is ${figma[side]}px`).toBeLessThan(1);
  }
  const rendered = await element.evaluate((el) => {
    // A CSS colour → "#rrggbb", or "#rrggbbaa" below alpha 1, or null when fully transparent. The
    // channels come from an opaque fill of the colour's own RGB (exact); the alpha from the colour.
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const paint = (fill: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = fill;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data;
    };
    const hex = (color: string) => {
      const [r, g, b] = paint(`rgb(from ${color} r g b)`);
      const alpha = paint(color)[3]!;
      if (alpha === 0) return null;
      const bytes = [r!, g!, b!];
      if (alpha < 255) bytes.push(alpha);
      return "#" + bytes.map((c) => c.toString(16).padStart(2, "0")).join("");
    };
    const style = getComputedStyle(el);
    const px = (value: string) => parseFloat(value) || 0;
    const aligns: Record<string, string> = { start: "left", end: "right" };
    let textCase = style.textTransform;
    if (style.fontVariantCaps.includes("small-caps")) textCase = "small-caps";
    let letterSpacing = 0;
    if (style.letterSpacing !== "normal") letterSpacing = px(style.letterSpacing);
    return {
      color: hex(style.color),
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight),
      lineHeight: parseFloat(style.lineHeight),
      fontFamily: style.fontFamily.split(",")[0]!.trim().replace(/^["']|["']$/g, ""),
      letterSpacing,
      textCase,
      textDecoration: style.textDecorationLine,
      textAlign: aligns[style.textAlign] ?? style.textAlign,
      opacity: parseFloat(style.opacity),
    };
  });
  if (figma.color !== null) {
    expectSameColor(rendered.color, figma.color, "text colour");
  } else {
    test.info().annotations.push({ type: "figma: not measured", description: "text colour: Figma's text colour is mixed or not solid, so it wasn't compared" });
  }
  expectFields(
    rendered,
    {
      fontSize: figma.fontSize,
      fontWeight: figma.fontWeight,
      lineHeight: figma.lineHeight ?? rendered.lineHeight,
      fontFamily: figma.fontFamily,
      letterSpacing: figma.letterSpacing,
      textCase: figma.textCase,
      textDecoration: figma.textDecoration,
      textAlign: figma.textAlign,
      opacity: figma.opacity,
    },
    "text",
  );
}

/**
 * Leaves an entry of a page export unmeasured, with the reason; the report lists it. For an
 * entry the helper can't read (a vector, a shadow with blur), never for one whose values fail.
 */
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
      if (parent === null) {
        test.info().annotations.push({ type: "figma: not measured", description: `${key}: position not compared, no ancestor of it is measured` });
        return;
      }
      const [box, parentBox] = await Promise.all([element.boundingBox(), elementOf(parent)!.boundingBox()]);
      if (!box || !parentBox) return; // expectToMatchFigma has already failed on a missing box
      expect.soft(Math.abs(box.x - parentBox.x - x), `x in ${parent} is ${box.x - parentBox.x}px, Figma's is ${x}px`).toBeLessThan(1);
      expect.soft(Math.abs(box.y - parentBox.y - y), `y in ${parent} is ${box.y - parentBox.y}px, Figma's is ${y}px`).toBeLessThan(1);
    });
  }
}

/**
 * Compares the values an element is drawn with against its Figma node, exactly: size, opacity,
 * fill, border (or outline), radius, shadows, focus rings, the layout's justify, align, wrap and
 * padding, the min and max sizes, and the label's colour and type. Screenshots are for a person or
 * a model to look at; this is the part that can't be fuzzy.
 *
 * Two allowances. The box may be under a pixel off: Figma snaps a text box to whole pixels
 * and a browser doesn't, so anything that hugs text differs by a fraction. Colours may
 * differ by 1 of 255 per channel (rounding), and an alpha by 1 of 255.
 *
 * Every value Figma has is compared; one the export doesn't have (an older export) isn't. A stroke
 * Figma centres can't be drawn in CSS, so it fails: move it inside or outside.
 *
 * Every comparison is soft: one run reports each value that differs, not only the first.
 *
 * Pass `width: false` where the width can't be compared: the element's text differs from the
 * Figma node's (a state variant labelled "Tab"), or it holds several text-hugging children,
 * whose fractions add up past a pixel. Not where the font differs from the design's: that is a
 * failure to report, and turning the check off hides it.
 */
export async function expectToMatchFigma(element: Locator, figma: FigmaNode, { width = true } = {}) {
  const box = await element.boundingBox();
  expect(box, "element is not rendered").not.toBeNull(); // hard: nothing else can be measured
  const measured: ("width" | "height")[] = ["height"];
  if (width) measured.unshift("width");
  for (const side of measured) {
    expect.soft(Math.abs(box![side] - figma[side]), `${side} is ${box![side]}px, Figma's is ${figma[side]}px`).toBeLessThan(1);
  }

  const rendered = await element.evaluate((el) => {
    // A CSS colour → "#rrggbb", or "#rrggbbaa" below alpha 1, or null when fully transparent. The
    // channels come from an opaque fill of the colour's own RGB (exact); the alpha from the colour.
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const paint = (fill: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = fill;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data;
    };
    const hex = (color: string) => {
      const [r, g, b] = paint(`rgb(from ${color} r g b)`);
      const alpha = paint(color)[3]!;
      if (alpha === 0) return null;
      const bytes = [r!, g!, b!];
      if (alpha < 255) bytes.push(alpha);
      return "#" + bytes.map((c) => c.toString(16).padStart(2, "0")).join("");
    };
    const style = getComputedStyle(el);
    const px = (value: string) => parseFloat(value) || 0;
    // A min or max size in px; none, auto and 0 are unset.
    const size = (value: string) => {
      if (value.endsWith("px") && parseFloat(value) > 0) return parseFloat(value);
      return null;
    };
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const corners = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"] as const;
    const borders = sides.map((side) => px(style[`border${side}Width`]));

    // box-shadow layers: a spread-only layer (no blur, no offset) is a ring, [colour, spread],
    // outermost first; a layer with a blur is a shadow. Fully transparent layers are neither.
    const rings: [string, number][] = [];
    const shadows: { x: number; y: number; blur: number; spread: number; color: string; inset: boolean }[] = [];
    for (const layer of style.boxShadow.split(/,(?![^(]*\))/).map((part) => part.trim())) {
      const ring = layer.match(/^(.+?) 0px 0px 0px ([\d.]+)px$/);
      const ringColor = ring && hex(ring[1]!);
      if (ring && ringColor && Number(ring[2]) > 0) rings.push([ringColor, Number(ring[2])]);
      const shadow = layer.match(/^(.+?) (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px( inset)?$/);
      const shadowColor = shadow && hex(shadow[1]!);
      if (shadow && shadowColor && Number(shadow[4]) > 0) {
        shadows.push({
          x: Number(shadow[2]),
          y: Number(shadow[3]),
          blur: Number(shadow[4]),
          spread: Number(shadow[5]),
          color: shadowColor,
          inset: shadow[6] !== undefined,
        });
      }
    }
    rings.sort((a, b) => b[1] - a[1]);

    // Where the label's text starts, measured from the element's left edge. Not the padding: after
    // a leading child (a dot, with its gap) the text starts further in.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let first: Text | null = null;
    let last: Text | null = null;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!/\S/.test(node.data)) continue;
      first ??= node;
      last = node;
    }
    let labelX = px(style.paddingLeft) + borders[3]!;
    if (first && last) {
      const range = document.createRange();
      range.setStart(first, 0);
      range.setEnd(last, last.length);
      labelX = range.getBoundingClientRect().left - el.getBoundingClientRect().left;
    }
    // A text's decoration is its own parent's: it isn't inherited.
    const owner = first?.parentElement ?? el;
    const aligns: Record<string, string> = { start: "left", end: "right" };
    const justifies: Record<string, string> = {
      normal: "start",
      "flex-start": "start",
      start: "start",
      "flex-end": "end",
      end: "end",
      center: "center",
      "space-between": "space-between",
    };
    const alignments: Record<string, string> = {
      "flex-start": "start",
      start: "start",
      normal: "stretch",
      stretch: "stretch",
      "flex-end": "end",
      end: "end",
      center: "center",
      baseline: "baseline",
    };
    let direction: "row" | "column" = "row";
    let gap = px(style.columnGap);
    if (style.flexDirection.startsWith("column")) {
      direction = "column";
      gap = px(style.rowGap);
    }
    let textCase = style.textTransform;
    if (style.fontVariantCaps.includes("small-caps")) textCase = "small-caps";
    let letterSpacing = 0;
    if (style.letterSpacing !== "normal") letterSpacing = px(style.letterSpacing);
    let stroke: string | null = null;
    if (borders.some((width) => width > 0)) stroke = hex(style.borderTopColor);
    return {
      opacity: parseFloat(style.opacity),
      fill: hex(style.backgroundColor),
      stroke,
      borders,
      borderStyle: style.borderTopStyle,
      // An outside stroke is an outline; its width is 0 when the outline is off.
      outline: {
        width: px(style.outlineWidth) * Number(style.outlineStyle !== "none"),
        color: hex(style.outlineColor),
        offset: px(style.outlineOffset),
        style: style.outlineStyle,
      },
      radius: corners.map((corner) => parseFloat(style[`border${corner}Radius`])),
      rings,
      shadows,
      minWidth: size(style.minWidth),
      maxWidth: size(style.maxWidth),
      minHeight: size(style.minHeight),
      maxHeight: size(style.maxHeight),
      layout: {
        direction,
        gap,
        // Without the borders: the caller adds them where Figma measures padding from the edge.
        padding: sides.map((side) => px(style[`padding${side}`])),
        justify: justifies[style.justifyContent] ?? style.justifyContent,
        align: alignments[style.alignItems] ?? style.alignItems,
        wrap: style.flexWrap !== "nowrap",
        rowGap: px(style.rowGap),
      },
      label: {
        x: labelX,
        y: px(style.paddingTop) + borders[0]!,
        height: parseFloat(style.lineHeight),
        color: hex(style.color),
        fontSize: parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
        lineHeight: parseFloat(style.lineHeight),
        fontFamily: style.fontFamily.split(",")[0]!.trim().replace(/^["']|["']$/g, ""),
        letterSpacing,
        textCase,
        textDecoration: getComputedStyle(owner).textDecorationLine,
        textAlign: aligns[style.textAlign] ?? style.textAlign,
      },
    };
  });

  expectFields(rendered, { opacity: figma.opacity }, "element");

  // The stroke: a border inside the box, or an outline outside it (CSS draws none outside).
  if (figma.strokeAlign === "center") {
    expect.soft(figma.strokeAlign, "CSS can't draw a centred stroke: Figma's stroke must be inside or outside").not.toBe("center");
  }
  if (figma.strokeAlign === "outside") {
    expect.soft(rendered.borders, "an outside stroke is an outline in CSS, so no border is drawn").toEqual([0, 0, 0, 0]);
    expect.soft(figma.strokeWeight, "an outline has one width; Figma's sides differ").not.toBeInstanceOf(Array);
    expect.soft(rendered.outline.width, "outline width").toBe(figma.strokeWeight);
    expect.soft(rendered.outline.offset, "outline offset").toBe(0);
    expectSameColor(rendered.outline.color, figma.stroke, "outline");
    if (figma.dashed || rendered.outline.width > 0) {
      expect.soft(rendered.outline.style, "outline style").toBe(lineStyle(figma.dashed));
    }
  } else {
    expect.soft(rendered.borders, "border width (top, right, bottom, left)").toEqual(fourOf<number>(figma.strokeWeight));
    expectSameColor(rendered.stroke, figma.stroke, "border");
    if (figma.dashed || rendered.borders.some((width) => width > 0)) {
      expect.soft(rendered.borderStyle, "border style").toBe(lineStyle(figma.dashed));
    }
  }

  expectSameColor(rendered.fill, figma.fill, "fill");

  // A radius past half the box is drawn as half the box: rounded-full computes to a huge value
  // where Figma says 9999. Both sides are clamped to the box each is drawn in, which is exact.
  const drawn = (radius: number, { width, height }: Region) => Math.min(radius, Math.min(width, height) / 2);
  if (figma.radius === null) {
    expect.soft(figma.radius, "Figma's corners have different radii; the export can't describe them").not.toBeNull();
  } else {
    expect
      .soft(
        rendered.radius.map((radius) => drawn(radius, box!)),
        "radius (top left, top right, bottom right, bottom left)",
      )
      .toEqual(fourOf<number>(figma.radius).map((radius) => drawn(radius, figma)));
  }

  // Figma can draw a ring another way (the ghost Button uses a rectangle), which this can't read.
  if (figma.rings.length > 0) {
    expect.soft(rendered.rings.map(([, spread]) => spread), "ring widths").toEqual(figma.rings.map(([, spread]) => spread));
    figma.rings.forEach(([color], i) => expectSameColor(rendered.rings[i]?.[0] ?? null, color, `ring ${i + 1}`));
  }

  if (figma.shadows) {
    expect.soft(rendered.shadows.map(shadowShape), "shadows (x, y, blur, spread, inset)").toEqual(figma.shadows.map(shadowShape));
    figma.shadows.forEach((shadow, i) => expectSameColor(rendered.shadows[i]?.color ?? null, shadow.color, `shadow ${i + 1} colour`));
  }

  for (const key of ["minWidth", "maxWidth", "minHeight", "maxHeight"] as const) {
    if (figma[key] !== undefined) expect.soft(rendered[key], key).toBe(figma[key] || null);
  }

  if (figma.layout) {
    const { strokesIncludedInLayout, ...layout } = figma.layout;
    // Figma measures padding from the node's edge, so the CSS border counts towards it, unless the
    // stroke is in the layout: then the padding starts inside it, as CSS padding does.
    const padding = rendered.layout.padding.map((side, i) => side + Number(!strokesIncludedInLayout) * rendered.borders[i]!);
    expectFields({ ...rendered.layout, padding }, layout, "layout");
  }

  if (figma.label) {
    const { color, ...label } = figma.label;
    const { color: renderedColor, ...renderedLabel } = rendered.label;
    expectSameColor(renderedColor, color, "text colour");
    expectFields(renderedLabel, label, "label");
  }
}
