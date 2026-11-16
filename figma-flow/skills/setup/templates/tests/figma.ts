import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

export type Region = { x: number; y: number; width: number; height: number };

/** A shadow that isn't a ring. Its colour is "#rrggbb", or "#rrggbbaa" when its alpha is below 1, as every colour in an export is. */
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

/** A sizing axis: hug (its content), fill (the room its parent leaves it) or fixed. */
export type Sizing = "hug" | "fill" | "fixed";

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
  /**
   * A focus ring Figma draws as a separate frame around the box, which CSS draws as the box's
   * outline, or as an offset ::before or ::after (see focusRingProblems): the ring's width, the gap
   * from the box's edge to its inner edge, and its colour. Null when there is none (and in an older
   * export, which has none to compare).
   */
  outline?: { width: number; offset: number; color: string } | null;
  /** Absolutely positioned children that the export couldn't read as the outline, by layer name. Reported, not compared. */
  unmeasured?: string[];
  /** Set by loadFigmaNodes and loadFigmaPage on a root (see nodesOf). Copies of the node keep it. */
  root?: true;
  /** Every shadow that isn't a ring (a blur, an offset, an inset ring), in the order CSS lists them. */
  shadows?: Shadow[];
  /** Across, then down. Absent from an export that doesn't record it; a root is never checked for fill. */
  sizing?: [horizontal: Sizing, vertical: Sizing];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  label:
    | ({
        x: number;
        y: number;
        height: number;
        color: string;
        fontSize: number;
        fontWeight: number;
        lineHeight: number;
      } & Typography)
    | null;
  /**
   * Present when the node lays out two or more children. Padding is top, right, bottom, left.
   * `strokesIncludedInLayout`, recorded for a node with a stroke, says whether the padding starts
   * inside the stroke (true, as inside a CSS border) or at the node's edge (false or absent).
   * `justify` is left out when the box hugs its direction with no min size on that axis, or a
   * child fills it; `align` when every child fills across or spans the content across. `wrap` and
   * `rowGap` are for a layout whose children wrap onto more lines.
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
 * Reads a file written in Figma (by the figma-flow skill's export-node, or a script in figma/). Its
 * last line is a hash of the rest, so a copy that lost or changed a character throws here instead
 * of testing against wrong numbers.
 */
export function loadFigmaExport(url: URL): Record<string, unknown> {
  const text = readFileSync(url, "utf8");
  const body = text.slice(0, text.lastIndexOf('  "hash"'));
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  const parsed = JSON.parse(text);
  if (hash.toString(16) !== parsed.hash) {
    throw new Error(`${url.pathname} doesn't match its hash: export it from Figma again`);
  }
  // JSON keeps only the last of two equal keys, so a repeated key would leave a node unmeasured
  // without a word. Exports from the current export-node number repeats; older ones may not.
  const written = [...body.matchAll(/^ {4}("(?:[^"\\]|\\.)*"):/gm)].map(
    (match) => JSON.parse(match[1]!) as string,
  );
  const repeated = written.filter((key, i) => written.indexOf(key) !== i);
  if (repeated.length > 0) {
    throw new Error(
      `${url.pathname} repeats ${[...new Set(repeated)].join(", ")}: export it again with the current figma-flow`,
    );
  }
  return parsed;
}

type Json = Record<string, unknown>;

/** Sets each key the object omits to its default, and returns the object. */
function fillIn(object: Json, defaults: Json) {
  for (const [key, value] of Object.entries(defaults)) if (!(key in object)) object[key] = value;
  return object;
}

/** The typography a label or a text leaves out at its default. */
const TYPOGRAPHY: Json = { letterSpacing: 0, textCase: "none", textDecoration: "none" };

/**
 * Puts back, on a copy, what a format-2 export left out at its default. A text on a page gets its
 * typography and opacity. A box gets the node defaults, its outline and unmeasured children, its
 * label's typography where there is a label, and a strokeAlign of inside where there is a stroke.
 */
function restore(node: Json): Json {
  if (node.type === "TEXT") return fillIn(node, { opacity: 1, ...TYPOGRAPHY });
  fillIn(node, {
    fill: null,
    stroke: null,
    strokeWeight: 0,
    radius: 0,
    rings: [],
    label: null,
    opacity: 1,
    shadows: [],
    outline: null,
    unmeasured: [],
  });
  if (node.label !== null) fillIn(node.label as Json, TYPOGRAPHY);
  if (node.stroke !== null && !("strokeAlign" in node)) node.strokeAlign = "inside";
  return node;
}

/**
 * The nodes of an export, by key. A format-2 export has its omitted defaults put back, on a copy;
 * an older export is taken as it is, and its absent fields are skipped. A root (a component's
 * variant, or a page entry with no parent) gets `root: true`: the fill check skips it, since its
 * DOM parent is the page's, not Figma's. The mark is on the data, so a copy of it keeps it.
 */
export function nodesOf<T>(exported: Json): Record<string, T> {
  const { format, variants } = exported;
  if (format !== undefined && format !== 2) {
    throw new Error(
      `format ${JSON.stringify(format)} isn't one this helper reads: export it again with the current figma-flow`,
    );
  }
  const nodes: Record<string, T> = {};
  for (const [key, value] of Object.entries(variants as Record<string, Json>)) {
    let node = value;
    if (format === 2) node = restore(structuredClone(value));
    // A page entry is a root when its parent is null; a component variant when its key has no " > ".
    let root = !key.includes(" > ");
    if ("parent" in node) root = node.parent === null;
    if (root) node.root = true;
    nodes[key] = node as T;
  }
  return nodes;
}

/** The nodes of a file written by the figma-flow skill's export-node. */
export function loadFigmaNodes(url: URL): Record<string, FigmaNode> {
  return nodesOf<FigmaNode>(loadFigmaExport(url));
}

/** A text node on a page, as export-node describes it. */
export type FigmaText = Region &
  Typography & {
    id: string;
    type: "TEXT";
    parent: string;
    /** Set on a root, as for FigmaNode. A text is never a root, so this is only there for the type. */
    root?: true;
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
  const nodes = nodesOf<FigmaPageNode>(loadFigmaExport(url));
  const notPage = Object.keys(nodes).filter((key) => !("parent" in nodes[key]!));
  if (notPage.length > 0)
    throw new Error(`${url.pathname} is not a page export (no parent on ${notPage[0]})`);
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
 * Whether two colours match: each channel within 1 of 255. An 8-digit colour (with alpha) against an
 * opaque one is a mismatch, even when its alpha rounds to 255. Null matches only null.
 */
function sameColor(actual: string | null, expected: string | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  const channels = (color: string) =>
    [1, 3, 5, 7].slice(0, 3 + Number(color.length === 9)).map((i) => parseInt(color.slice(i, i + 2), 16));
  const [rendered, figma] = [channels(actual), channels(expected)];
  return rendered.length === figma.length && rendered.every((c, i) => Math.abs(c - figma[i]!) <= 1);
}

function expectSameColor(actual: string | null, expected: string | null, what: string) {
  expect.soft(sameColor(actual, expected), `${what} is ${actual}, Figma's is ${expected}`).toBe(true);
}

/**
 * A radius past half the box is drawn as half the box: rounded-full computes to a huge value where
 * Figma says 9999. Both sides are clamped to the box each is drawn in, which is exact.
 */
const drawn = (radius: number, { width, height }: { width: number; height: number }) =>
  Math.min(radius, Math.min(width, height) / 2);

type Outline = NonNullable<FigmaNode["outline"]>;

/** A ::before or ::after as it is drawn: the values a focus ring is made of. */
type Pseudo = {
  /** Absolutely positioned, with content and a display and visibility that draw it. */
  shown: boolean;
  inset: number[];
  margin: number[];
  size: number[];
  radius: number[];
  fill: string | null;
  borders: number[];
  opacity: number;
  rings: [string, number][];
  shadows: Shadow[];
};

/** The element as it is drawn, for its focus ring. */
type Painted = {
  borders: number[];
  radius: number[];
  outline: { width: number; color: string | null; offset: number; style: string };
  position: string;
  overflow: string[];
  before: Pseudo;
  after: Pseudo;
};

/** Each way the outline differs from Figma's, named. */
function outlineProblems(outline: Painted["outline"], figma: Outline) {
  const problems: string[] = [];
  if (outline.style !== "solid") problems.push(`outline-style is ${outline.style}, Figma's is solid`);
  if (outline.width !== figma.width) problems.push(`outline-width is ${outline.width}px, Figma's is ${figma.width}px`);
  if (outline.offset !== figma.offset)
    problems.push(`outline-offset is ${outline.offset}px, Figma's is ${figma.offset}px`);
  if (!sameColor(outline.color, figma.color)) problems.push(`outline-color is ${outline.color}, Figma's is ${figma.color}`);
  return problems;
}

/**
 * Each way a ::before or ::after differs from the ring Figma draws, named: an absolute box inset by
 * the offset from the element's border box on every side, with no margin, a border or a fill, of the
 * border box grown by the offset on each side, its corners the element's grown by the offset, and one
 * spread-only ring of the outline's width and colour, with nothing else painted on it.
 */
function ringProblems(name: string, ring: Pseudo, painted: Painted, box: Region, figma: Outline) {
  const { width, offset, color } = figma;
  const problems: string[] = [];
  if (painted.position === "static") problems.push("the element is position: static, so the ring isn't placed on it");
  if (painted.overflow.some((axis) => axis !== "visible"))
    problems.push(`the element clips its overflow (overflow-x ${painted.overflow[0]}, overflow-y ${painted.overflow[1]}), which clips a ring`);
  const sides = ["top", "right", "bottom", "left"] as const;
  const wrong = new Set(sides.map((_, i) => -ring.inset[i]! - painted.borders[i]!).filter((d) => d !== offset));
  for (const drawnOffset of wrong) problems.push(`${name} ring offset is ${drawnOffset}px, Figma's is ${offset}px`);
  ring.margin.forEach((margin, i) => {
    if (margin !== 0) problems.push(`${name} margin-${sides[i]} is ${margin}px, Figma's is 0px`);
  });
  const [expectedWidth, expectedHeight] = [box.width + 2 * offset, box.height + 2 * offset];
  if (Math.abs(ring.size[0]! - expectedWidth) >= 1)
    problems.push(`${name} ring width is ${ring.size[0]}px, its box plus the offset is ${expectedWidth}px`);
  if (Math.abs(ring.size[1]! - expectedHeight) >= 1)
    problems.push(`${name} ring height is ${ring.size[1]}px, its box plus the offset is ${expectedHeight}px`);
  const ringBox = { width: ring.size[0]!, height: ring.size[1]! };
  const expectedRadii = painted.radius.map((radius) => {
    const clamped = drawn(radius, box);
    return clamped === 0 ? 0 : Math.max(clamped + offset, 0);
  });
  const radii = ring.radius.map((radius) => drawn(radius, ringBox));
  if (radii.some((radius, i) => radius !== expectedRadii[i]))
    problems.push(`${name} ring radius (top left, top right, bottom right, bottom left) is ${radii}, Figma's is ${expectedRadii}`);
  if (ring.fill !== null) problems.push(`${name} background is ${ring.fill}, the ring must be see-through`);
  if (ring.borders.some((border) => border > 0)) problems.push(`${name} has a border, the ring has none`);
  if (ring.opacity !== 1) problems.push(`${name} opacity is ${ring.opacity}, Figma's is 1`);
  if (ring.shadows.length > 0) problems.push(`${name} has a shadow that isn't a ring (a blur, an offset or an inset)`);
  if (ring.rings.length !== 1) {
    problems.push(`${name} has ${ring.rings.length} rings, Figma's has one`);
  } else {
    const [ringColor, spread] = ring.rings[0]!;
    if (spread !== width) problems.push(`${name} ring width is ${spread}px, Figma's is ${width}px`);
    if (!sameColor(ringColor, color)) problems.push(`${name} ring colour is ${ringColor}, Figma's is ${color}`);
  }
  return problems;
}

/**
 * The focus ring Figma draws, against the element as it is drawn. It holds as the element's own CSS
 * outline (a solid line at the ring's width, offset and colour), or, where the element draws no
 * outline of its own, as a ::before or ::after that is the ring (ringProblems): the way Figma's
 * Simple Design System draws focus. When neither holds, the list has every mismatch on each path
 * that has one, so a failure says what was found on each.
 */
function focusRingProblems(painted: Painted, box: Region, figma: Outline): string[] {
  const own = outlineProblems(painted.outline, figma);
  if (own.length === 0) return [];
  const drawsOwn = painted.outline.width > 0 && painted.outline.color !== null;
  const pseudos = [
    ["::before", painted.before],
    ["::after", painted.after],
  ] as const;
  const rings = pseudos
    .filter(([, ring]) => ring.shown)
    .map(([name, ring]) => ringProblems(name, ring, painted, box, figma));
  const clean = rings.some((problems) => problems.length === 0);
  if (clean && !drawsOwn) return [];
  const second = clean ? ["the element draws its own outline too, so the ring would be a second one"] : [];
  return [...own, ...rings.flat(), ...second];
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
        .soft(
          Math.abs((actual as number) - (expected as number)),
          `${what}: ${key} is ${actual}, Figma's is ${expected}`,
        )
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
    expect
      .soft(Math.abs(box![side] - figma[side]), `${side} is ${box![side]}px, Figma's is ${figma[side]}px`)
      .toBeLessThan(1);
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
    // The text's parent: the decorations drawn on it are set on that parent or an ancestor, up to
    // an inline-block, a float or a positioned box, which draw their own.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let owner: Element = el;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (/\S/.test(node.textContent ?? "")) {
        owner = node.parentElement ?? el;
        break;
      }
    }
    const decorations = (from: Element) => {
      const lines = new Set<string>();
      for (let node: Element | null = from; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        for (const line of style.textDecorationLine.split(" ")) lines.add(line);
        const boxed =
          style.display.startsWith("inline-") ||
          style.cssFloat !== "none" ||
          style.position === "absolute" ||
          style.position === "fixed";
        if (boxed) break;
      }
      const drawn = ["underline", "line-through"].filter((line) => lines.has(line));
      return drawn.join(" ") || "none";
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
      fontFamily: style.fontFamily
        .split(",")[0]!
        .trim()
        .replace(/^["']|["']$/g, ""),
      letterSpacing,
      textCase,
      textDecoration: decorations(owner),
      textAlign: aligns[style.textAlign] ?? style.textAlign,
      opacity: parseFloat(style.opacity),
    };
  });
  if (figma.color !== null) {
    expectSameColor(rendered.color, figma.color, "text colour");
  } else {
    test.info().annotations.push({
      type: "figma: not measured",
      description: "text colour: Figma's text colour is mixed or not solid, so it wasn't compared",
    });
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
 * entry the helper can't read (a vector, a ring Figma draws as a separate shape), never for one
 * whose values fail.
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
export async function expectPageToMatchFigma(
  nodes: Record<string, FigmaPageNode>,
  locate: Record<string, Located>,
) {
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
    const options: { width?: false; position?: false } = {};
    if ("element" in where) {
      options.width = where.width;
      options.position = where.position;
    }
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
        test.info().annotations.push({
          type: "figma: not measured",
          description: `${key}: position not compared, no ancestor of it is measured`,
        });
        return;
      }
      const [box, parentBox] = await Promise.all([element.boundingBox(), elementOf(parent)!.boundingBox()]);
      if (!box || !parentBox) return; // expectToMatchFigma has already failed on a missing box
      expect
        .soft(
          Math.abs(box.x - parentBox.x - x),
          `x in ${parent} is ${box.x - parentBox.x}px, Figma's is ${x}px`,
        )
        .toBeLessThan(1);
      expect
        .soft(
          Math.abs(box.y - parentBox.y - y),
          `y in ${parent} is ${box.y - parentBox.y}px, Figma's is ${y}px`,
        )
        .toBeLessThan(1);
    });
  }
}

/**
 * Checks an element's fill axes against its DOM parent. Across, the element spans the parent's
 * content box. Along a flex parent, it has a flex-grow of at least 1 or leaves no free room for
 * anything else. A parent that isn't a flex container can't say, so the check is skipped and
 * reported. Nor can a parent that wraps: its siblings may be on other lines, so the main axis is
 * skipped and reported.
 */
async function expectFillMatches(element: Locator, sizing: [Sizing, Sizing]) {
  const axes: ("horizontal" | "vertical")[] = [];
  if (sizing[0] === "fill") axes.push("horizontal");
  if (sizing[1] === "fill") axes.push("vertical");
  if (axes.length === 0) return;
  const fill = await element.evaluate((el, wanted) => {
    const parent = el.parentElement;
    if (parent === null) return { reason: "it has no parent element" };
    const parentStyle = getComputedStyle(parent);
    if (!parentStyle.display.includes("flex")) {
      return { reason: `its parent is display: ${parentStyle.display}, not a flex container` };
    }
    const px = (value: string) => parseFloat(value) || 0;
    const column = parentStyle.flexDirection.startsWith("column");
    const siblings = [...parent.children].filter((child) => {
      const style = getComputedStyle(child);
      return (
        child !== el &&
        style.display !== "none" &&
        style.position !== "absolute" &&
        style.position !== "fixed"
      );
    });
    const wrap = parentStyle.flexWrap !== "nowrap";
    return {
      axes: wanted.map((axis) => {
        const horizontal = axis === "horizontal";
        let key: "width" | "height" = "height";
        let gap = px(parentStyle.rowGap);
        let content = parent.clientHeight - px(parentStyle.paddingTop) - px(parentStyle.paddingBottom);
        if (horizontal) {
          key = "width";
          gap = px(parentStyle.columnGap);
          content = parent.clientWidth - px(parentStyle.paddingLeft) - px(parentStyle.paddingRight);
        }
        const size = el.getBoundingClientRect()[key];
        const main = horizontal !== column;
        if (!main)
          return {
            axis,
            main,
            wrap,
            across: size - content,
            size,
            content,
            free: 0,
            grow: false,
            noRoom: false,
          };
        const used = siblings.reduce((sum, child) => sum + child.getBoundingClientRect()[key], 0);
        const free = content - used - gap * siblings.length;
        const grow = parseFloat(getComputedStyle(el).flexGrow) >= 1;
        const noRoom = Math.abs(free - size) < 1;
        return { axis, main, wrap, across: size - content, size, content, free, grow, noRoom };
      }),
    };
  }, axes);
  if ("reason" in fill) {
    test.info().annotations.push({
      type: "figma: not measured",
      description: `sizing: fill isn't checked, ${fill.reason}`,
    });
    return;
  }
  for (const check of fill.axes) {
    if (check.main && check.wrap) {
      test.info().annotations.push({
        type: "figma: not measured",
        description: `sizing: fill on ${check.axis} isn't checked, its parent wraps, so its siblings may be on other lines`,
      });
    } else if (check.main) {
      expect
        .soft(
          check.grow || check.noRoom,
          `${check.axis} is fill: the element is ${check.size}px, its parent has ${check.free}px free for it, and its flex-grow is under 1`,
        )
        .toBe(true);
    } else {
      expect
        .soft(
          Math.abs(check.across),
          `${check.axis} is fill: the element is ${check.size}px, its parent's content box is ${check.content}px`,
        )
        .toBeLessThan(1);
    }
  }
}

/**
 * Compares the values an element is drawn with against its Figma node, exactly: size, opacity,
 * fill, border (or outline), radius, shadows, focus rings, the layout's justify, align, wrap and
 * padding, the min and max sizes, and the label's colour and type. Screenshots are for a person or
 * a model to look at; this is the part that can't be fuzzy. A focus ring Figma draws as a separate
 * frame is compared as the element's outline, or as its ::before or ::after ring (`outline`). A child the export couldn't read as one
 * (`unmeasured`) is named in a "figma: not measured" annotation; the test still passes on the rest.
 *
 * Two allowances. The box may be under a pixel off: Figma snaps a text box to whole pixels
 * and a browser doesn't, so anything that hugs text differs by a fraction. Colours may
 * differ by 1 of 255 per channel (rounding), and an alpha by 1 of 255.
 *
 * Every value Figma has is compared; one the export doesn't have (an older export) isn't. A stroke
 * Figma centres can't be drawn in CSS, so it fails: move it inside or outside. A stroke is expected
 * solid unless the node is dashed; an older export that records neither its stroke's alignment
 * nor a dash isn't checked for style at all.
 *
 * A "fill" axis (`sizing`) is checked against the element's flex parent (see expectFillMatches).
 * A root (a component's variant, or a page entry with no parent, marked `root` by the loader) is
 * never checked for fill.
 *
 * Every comparison is soft: one run reports each value that differs, not only the first.
 *
 * Pass `width: false` where the width can't be compared: the element's text differs from the
 * Figma node's (a state variant labelled "Tab"), or it holds several text-hugging children,
 * whose fractions add up past a pixel. Not where the font differs from the design's: that is a
 * failure to report, and turning the check off hides it. Pass `sizing: false` where the parent's
 * layout differs from Figma's on purpose.
 */
export async function expectToMatchFigma(
  element: Locator,
  figma: FigmaNode,
  { width = true, sizing = true } = {},
) {
  const box = await element.boundingBox();
  expect(box, "element is not rendered").not.toBeNull(); // hard: nothing else can be measured
  const measured: ("width" | "height")[] = ["height"];
  if (width) measured.unshift("width");
  for (const side of measured) {
    expect
      .soft(Math.abs(box![side] - figma[side]), `${side} is ${box![side]}px, Figma's is ${figma[side]}px`)
      .toBeLessThan(1);
  }
  if (sizing && figma.sizing && !figma.root) await expectFillMatches(element, figma.sizing);

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

    // box-shadow layers: a spread-only layer (no blur, no offset, not inset) is a ring, [colour,
    // spread], outermost first; every other layer is a shadow, an inset ring included. Fully
    // transparent layers are neither.
    const layers = (computed: CSSStyleDeclaration) => {
      const rings: [string, number][] = [];
      const shadows: Shadow[] = [];
      for (const layer of computed.boxShadow.split(/,(?![^(]*\))/).map((part) => part.trim())) {
        const ring = layer.match(/^(.+?) 0px 0px 0px (-?[\d.]+)px$/);
        const ringColor = ring && hex(ring[1]!);
        if (ring && ringColor && Number(ring[2]) !== 0) rings.push([ringColor, Number(ring[2])]);
        const shadow = layer.match(/^(.+?) (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px( inset)?$/);
        const shadowColor = shadow && hex(shadow[1]!);
        if (shadow && shadowColor && !ring) {
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
      return { rings, shadows };
    };
    const { rings, shadows } = layers(style);

    // A ::before or ::after as it is drawn: a focus ring Figma's Simple Design System draws as one.
    const pseudo = (which: "::before" | "::after"): Pseudo => {
      const computed = getComputedStyle(el, which);
      const painted = layers(computed);
      return {
        shown:
          computed.position === "absolute" &&
          computed.content !== "none" &&
          computed.content !== "normal" &&
          computed.display !== "none" &&
          computed.visibility === "visible",
        inset: [computed.top, computed.right, computed.bottom, computed.left].map((value) => px(value)),
        margin: sides.map((side) => px(computed[`margin${side}`])),
        size: [px(computed.width), px(computed.height)],
        radius: corners.map((corner) => parseFloat(computed[`border${corner}Radius`])),
        fill: hex(computed.backgroundColor),
        borders: sides.map((side) => px(computed[`border${side}Width`])),
        opacity: parseFloat(computed.opacity),
        rings: painted.rings,
        shadows: painted.shadows,
      };
    };

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
    // The decorations drawn on the label: those set on its parent and each ancestor up to and
    // including the element (the decoration is drawn over what's inside it, not what's outside).
    const owner = first?.parentElement ?? el;
    const decorations = (from: Element, stop: Element) => {
      const lines = new Set<string>();
      for (let node: Element | null = from; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        for (const line of style.textDecorationLine.split(" ")) lines.add(line);
        // An inline-block, a float or a positioned box draws its own decorations, not its parent's.
        const boxed =
          style.display.startsWith("inline-") ||
          style.cssFloat !== "none" ||
          style.position === "absolute" ||
          style.position === "fixed";
        if (node === stop || boxed) break;
      }
      const drawn = ["underline", "line-through"].filter((line) => lines.has(line));
      return drawn.join(" ") || "none";
    };
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
      position: style.position,
      overflow: [style.overflowX, style.overflowY],
      before: pseudo("::before"),
      after: pseudo("::after"),
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
        fontFamily: style.fontFamily
          .split(",")[0]!
          .trim()
          .replace(/^["']|["']$/g, ""),
        letterSpacing,
        textCase,
        textDecoration: decorations(owner, el),
        textAlign: aligns[style.textAlign] ?? style.textAlign,
      },
    };
  });

  expectFields(rendered, { opacity: figma.opacity }, "element");

  // A stroke is expected solid unless it is dashed. An older export with neither a stroke nor
  // strokeAlign says nothing about its style, so it isn't checked.
  const styled = figma.dashed === true || (figma.stroke !== null && figma.strokeAlign !== undefined);

  // The stroke: a border inside the box, or an outline outside it (CSS draws none outside).
  if (figma.strokeAlign === "center") {
    expect
      .soft(figma.strokeAlign, "CSS can't draw a centred stroke: Figma's stroke must be inside or outside")
      .not.toBe("center");
  }
  if (figma.strokeAlign === "outside") {
    expect
      .soft(rendered.borders, "an outside stroke is an outline in CSS, so no border is drawn")
      .toEqual([0, 0, 0, 0]);
    expect
      .soft(figma.strokeWeight, "an outline has one width; Figma's sides differ")
      .not.toBeInstanceOf(Array);
    expect.soft(rendered.outline.width, "outline width").toBe(figma.strokeWeight);
    expect.soft(rendered.outline.offset, "outline offset").toBe(0);
    expectSameColor(rendered.outline.color, figma.stroke, "outline");
    if (styled) expect.soft(rendered.outline.style, "outline style").toBe(lineStyle(figma.dashed));
  } else {
    expect
      .soft(rendered.borders, "border width (top, right, bottom, left)")
      .toEqual(fourOf<number>(figma.strokeWeight));
    expectSameColor(rendered.stroke, figma.stroke, "border");
    if (styled) expect.soft(rendered.borderStyle, "border style").toBe(lineStyle(figma.dashed));
  }

  // A focus ring Figma draws as a separate frame. CSS draws it as the element's own outline (a solid
  // line at the ring's width, offset and colour), or, where the element draws no outline of its own,
  // as an offset ::before or ::after with one spread-only box-shadow: how Figma's Simple Design
  // System draws focus. Compared only where Figma has one (focusRingProblems says how).
  if (figma.outline) {
    expect
      .soft(
        focusRingProblems(rendered, box!, figma.outline),
        "focus ring: the element's outline, or its ::before or ::after, isn't Figma's",
      )
      .toEqual([]);
  }
  for (const name of figma.unmeasured ?? []) {
    test.info().annotations.push({
      type: "figma: not measured",
      description: `${name}: absolutely positioned, and not an outline the export can read, so it wasn't compared`,
    });
  }

  expectSameColor(rendered.fill, figma.fill, "fill");

  // Both sides are clamped to the box each is drawn in (drawn).
  if (figma.radius === null) {
    expect
      .soft(figma.radius, "Figma's corners have different radii; the export can't describe them")
      .not.toBeNull();
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
    expect
      .soft(
        rendered.rings.map(([, spread]) => spread),
        "ring widths",
      )
      .toEqual(figma.rings.map(([, spread]) => spread));
    figma.rings.forEach(([color], i) =>
      expectSameColor(rendered.rings[i]?.[0] ?? null, color, `ring ${i + 1}`),
    );
  }

  if (figma.shadows) {
    expect
      .soft(rendered.shadows.map(shadowShape), "shadows (x, y, blur, spread, inset)")
      .toEqual(figma.shadows.map(shadowShape));
    figma.shadows.forEach((shadow, i) =>
      expectSameColor(rendered.shadows[i]?.color ?? null, shadow.color, `shadow ${i + 1} colour`),
    );
  }

  for (const key of ["minWidth", "maxWidth", "minHeight", "maxHeight"] as const) {
    if (figma[key] !== undefined) expect.soft(rendered[key], key).toBe(figma[key] || null);
  }

  if (figma.layout) {
    const { strokesIncludedInLayout, ...layout } = figma.layout;
    // Figma measures padding from the node's edge, so the CSS border counts towards it, unless the
    // stroke is in the layout: then the padding starts inside it, as CSS padding does.
    const padding = rendered.layout.padding.map(
      (side, i) => side + Number(!strokesIncludedInLayout) * rendered.borders[i]!,
    );
    expectFields({ ...rendered.layout, padding }, layout, "layout");
  }

  if (figma.label) {
    const { color, ...label } = figma.label;
    const { color: renderedColor, ...renderedLabel } = rendered.label;
    expectSameColor(renderedColor, color, "text colour");
    expectFields(renderedLabel, label, "label");
  }
}
