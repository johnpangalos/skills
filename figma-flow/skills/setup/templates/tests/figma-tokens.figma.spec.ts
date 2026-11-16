import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Template: every export's `tokens` must agree with the token snapshot (tokens.json in the exports
// folder, from figma-flow's export-tokens). A token is the name of the Figma variable or style a value
// is bound to; the export also records the value, so the two must agree. Needs no page. Replace the
// placeholder: the path to the exports folder.
//
// A name in `var(...)` or `calc(...)` form is a variable's web code syntax. Any other name is a
// variable's name (or its web, like `1px`), except `text` (a text style's name) and `effect` (an
// effect style's name). A name that is none of these fails. A paint style (fill, stroke or
// textColor bound to a colour style) isn't in the snapshot: its name is "figma: not measured".
// `opacity` is not measured either: Figma's opacity variables may be in percent.
//
// A variable matches when the export's value equals its value or one of its modes' values. A colour
// compares its first six hex digits: an 8-digit colour's alpha is the paint's own, not the variable's.
// `text` must agree with the entry's text (a null weight in the style is skipped); `effect` must agree
// with its shadows and rings, layer by layer. An export with `"format": 2` has its defaults filled in
// first, as loadFigmaNodes does; one with no format is read as it is.
type Json = Record<string, unknown>;
type Variable = { value: unknown; web: string | null; modes?: Record<string, unknown> };
type TextStyle = {
  family: string;
  size: number;
  lineHeight: number | "AUTO";
  weight?: number | null;
  letterSpacing?: number;
  textCase?: string;
  textDecoration?: string;
};
type Layer = {
  type: string;
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  alpha?: number;
};
type SnapshotFile = {
  textStyles?: Record<string, TextStyle>;
  effectStyles?: Record<string, Layer[]>;
  [collection: string]: unknown;
};
type Snapshot = {
  variables: { name: string; variable: Variable }[];
  textStyles: Record<string, TextStyle>;
  effectStyles: Record<string, Layer[]>;
};

// export-tokens' output: the variables by collection, then the text and effect styles.
function readSnapshot(file: SnapshotFile): Snapshot {
  const { textStyles = {}, effectStyles = {}, ...collections } = file;
  const variables = Object.entries(collections).flatMap(([, entries]) =>
    Object.entries(entries as Record<string, Variable>).map(([name, variable]) => ({ name, variable })),
  );
  return { variables, textStyles, effectStyles };
}

const TOLERANCE = 0.01; // the export rounds to 2 decimals; so does the snapshot's alpha
const CSS_NAME = /^(var|calc)\(/;
const PAINT = new Set(["fill", "stroke", "textColor"]);
const SIDED = new Set(["strokeWeight", "radius", "padding"]);
// Recorded only inside `layout`, which an entry has when two or more children are laid out.
const LAYOUT = new Set(["gap", "rowGap", "padding"]);
const SIDE_NAMES: Record<string, string[]> = {
  strokeWeight: ["top", "right", "bottom", "left"],
  padding: ["top", "right", "bottom", "left"],
  radius: ["top-left", "top-right", "bottom-right", "bottom-left"],
};
// The defaults a format-2 export leaves out. A TEXT entry has no box fields; a label has text ones.
const BOX_DEFAULTS: Json = {
  fill: null,
  stroke: null,
  strokeWeight: 0,
  radius: 0,
  rings: [],
  label: null,
  opacity: 1,
  shadows: [],
};
const TEXT_DEFAULTS: Json = { letterSpacing: 0, textCase: "none", textDecoration: "none" };

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const listOf = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return [];
};
const sideOf = (value: unknown, i: number): unknown => {
  if (Array.isArray(value)) return value[i];
  return value;
};
const sideCount = (...values: unknown[]) => {
  if (values.some(Array.isArray)) return 4;
  return 1;
};
const sideLabel = (field: string, i: number, count: number) => {
  if (count === 1) return "";
  return ` (${SIDE_NAMES[field]![i]})`;
};
const lineHeightOf = (style: TextStyle) => {
  if (style.lineHeight === "AUTO") return null;
  return style.lineHeight;
};
const layoutOf = (entry: Json): Json => {
  if (isObject(entry.layout)) return entry.layout;
  return {};
};
const textOf = (entry: Json): Json | null => {
  if (entry.type === "TEXT") return entry;
  if (isObject(entry.label)) return entry.label;
  return null;
};
const alphaOf = (colour: string) => {
  if (colour.length === 9) return parseInt(colour.slice(7), 16) / 255;
  return 1;
};

// The variable a name is: by its web code syntax, or by its name (a bare name that is a web, `1px`, too).
function variableNamed(snapshot: Snapshot, name: string) {
  const byWeb = snapshot.variables.find(({ variable }) => variable.web === name);
  if (byWeb || CSS_NAME.test(name)) return byWeb;
  return snapshot.variables.find((entry) => entry.name === name);
}

// Equal as the export records them: numbers within rounding, colours by their six hex digits.
function same(exported: unknown, value: unknown): boolean {
  if (typeof exported === "number" && typeof value === "number")
    return Math.abs(exported - value) < TOLERANCE;
  if (typeof exported === "string" && typeof value === "string" && value.startsWith("#")) {
    return exported.slice(0, 7).toLowerCase() === value.slice(0, 7).toLowerCase();
  }
  return exported === value;
}
const matchesVariable = (exported: unknown, { value, modes = {} }: Variable) =>
  [value, ...Object.values(modes)].some((candidate) => same(exported, candidate));

// A colour as the export writes it, against a snapshot colour and its alpha.
const colourMatches = (exported: unknown, colour = "", alpha = 1) =>
  typeof exported === "string" &&
  exported.slice(0, 7).toLowerCase() === colour.toLowerCase() &&
  Math.abs(alphaOf(exported) - alpha) < TOLERANCE;
const isRing = (layer: Layer) =>
  layer.type === "DROP_SHADOW" && layer.blur === 0 && layer.x === 0 && layer.y === 0;
// A shadow with no blur, no offset and no spread draws nothing: the export leaves it out.
const drawsNothing = (layer: Layer) =>
  (layer.type === "DROP_SHADOW" || layer.type === "INNER_SHADOW") &&
  layer.blur === 0 &&
  layer.x === 0 &&
  layer.y === 0 &&
  layer.spread === 0;

type Found = { where: string; entry: Json; tokens: Json };
// Every entry that has `tokens`, with the keys down to it.
function entriesWithTokens(file: string, node: unknown, path: string[] = [], found: Found[] = []): Found[] {
  if (Array.isArray(node)) {
    node.forEach((item, i) => entriesWithTokens(file, item, [...path, String(i)], found));
    return found;
  }
  if (!isObject(node)) return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === "tokens" && isObject(value))
      found.push({ where: `${file} ${path.join(" > ")}`, entry: node, tokens: value });
    else entriesWithTokens(file, value, [...path, key], found);
  }
  return found;
}

// The entry with the defaults a format-2 export leaves out filled back in.
function withDefaults(entry: Json, format2: boolean): Json {
  if (!format2) return entry;
  if (entry.type === "TEXT") return { ...TEXT_DEFAULTS, ...entry };
  const filled: Json = { ...BOX_DEFAULTS, ...entry };
  if (isObject(filled.label)) filled.label = { ...TEXT_DEFAULTS, ...filled.label };
  return filled;
}

// The value each field is drawn with, as the export records it.
type Read = (entry: Json, text: Json | null) => unknown;
const READ: Record<string, Read> = {
  fill: (entry) => entry.fill,
  stroke: (entry) => entry.stroke,
  strokeWeight: (entry) => entry.strokeWeight,
  radius: (entry) => entry.radius,
  opacity: (entry) => entry.opacity,
  width: (entry) => entry.width,
  height: (entry) => entry.height,
  minWidth: (entry) => entry.minWidth,
  maxWidth: (entry) => entry.maxWidth,
  minHeight: (entry) => entry.minHeight,
  maxHeight: (entry) => entry.maxHeight,
  gap: (entry) => layoutOf(entry).gap,
  rowGap: (entry) => layoutOf(entry).rowGap,
  padding: (entry) => layoutOf(entry).padding,
  textColor: (_entry, text) => text?.color,
  fontFamily: (_entry, text) => text?.fontFamily,
  fontSize: (_entry, text) => text?.fontSize,
  fontWeight: (_entry, text) => text?.fontWeight,
  lineHeight: (_entry, text) => text?.lineHeight,
  letterSpacing: (_entry, text) => text?.letterSpacing,
};

type Context = {
  where: string;
  entry: Json;
  text: Json | null;
  snapshot: Snapshot;
  problems: string[];
  notMeasured: string[];
};

function checkName(ctx: Context, at: string, field: string, name: string, value: unknown) {
  const found = variableNamed(ctx.snapshot, name);
  if (!found) {
    if (PAINT.has(field) && !CSS_NAME.test(name))
      ctx.notMeasured.push(`${at}: "${name}" is a paint style, which the snapshot doesn't hold`);
    else ctx.problems.push(`${at}: "${name}" is not a variable in the token snapshot`);
    return;
  }
  if (field === "opacity") {
    ctx.notMeasured.push(`${at}: "${name}" isn't compared: Figma's opacity variables may be in percent`);
    return;
  }
  if (value === undefined && LAYOUT.has(field)) {
    ctx.notMeasured.push(`${at}: "${name}" isn't compared: the export records no ${field} for this box`);
    return;
  }
  if (value === undefined || value === null) {
    ctx.problems.push(`${at}: "${name}" is bound, but the export records no ${field}`);
    return;
  }
  if (!matchesVariable(value, found.variable)) {
    ctx.problems.push(
      `${at}: "${name}" is ${JSON.stringify(found.variable.value)} in Figma, but the export has ${JSON.stringify(value)}`,
    );
  }
}

function checkValue(ctx: Context, at: string, field: string, token: unknown) {
  const read = READ[field]!;
  const exported = read(ctx.entry, ctx.text);
  // A one-name token applies to every side, a list names each side (null where a side has none).
  const count = sideCount(token, exported);
  for (let i = 0; i < count; i++) {
    const name = sideOf(token, i);
    if (typeof name === "string")
      checkName(ctx, `${at}${sideLabel(field, i, count)}`, field, name, sideOf(exported, i));
  }
}

function checkText(ctx: Context, at: string, token: unknown) {
  if (typeof token !== "string") {
    ctx.problems.push(`${at}: ${JSON.stringify(token)} is not a text style in the token snapshot`);
    return;
  }
  const style = ctx.snapshot.textStyles[token];
  if (!style) {
    ctx.problems.push(`${at}: ${JSON.stringify(token)} is not a text style in the token snapshot`);
    return;
  }
  if (!ctx.text) {
    ctx.problems.push(`${at}: "${token}" is a text style, but the entry has no text to check it against`);
    return;
  }
  const text = ctx.text;
  const checks: [string, unknown, unknown][] = [
    ["size", text.fontSize, style.size],
    ["lineHeight", text.lineHeight, lineHeightOf(style)],
    ["family", text.fontFamily, style.family],
  ];
  if (typeof style.weight === "number") checks.push(["weight", text.fontWeight, style.weight]);
  if (style.letterSpacing !== undefined)
    checks.push(["letterSpacing", text.letterSpacing, style.letterSpacing]);
  if (style.textCase !== undefined) checks.push(["textCase", text.textCase, style.textCase]);
  if (style.textDecoration !== undefined)
    checks.push(["textDecoration", text.textDecoration, style.textDecoration]);
  for (const [property, actual, expected] of checks) {
    if (!same(actual, expected)) {
      ctx.problems.push(
        `${at}: "${token}" says ${property} ${JSON.stringify(expected)}, but the text has ${JSON.stringify(actual)}`,
      );
    }
  }
}

function checkEffect(ctx: Context, at: string, token: unknown) {
  if (typeof token !== "string") {
    ctx.problems.push(`${at}: ${JSON.stringify(token)} is not an effect style in the token snapshot`);
    return;
  }
  const layers = ctx.snapshot.effectStyles[token];
  if (!layers) {
    ctx.problems.push(`${at}: ${JSON.stringify(token)} is not an effect style in the token snapshot`);
    return;
  }
  // Blurs aren't shadows, so the export doesn't list them. What draws nothing is left out.
  const drawn = layers.filter(
    (layer) => (layer.type === "DROP_SHADOW" || layer.type === "INNER_SHADOW") && !drawsNothing(layer),
  );
  const rings = drawn.filter(isRing);
  const shadows = drawn.filter((layer) => !isRing(layer));
  const inOrder = <T>(expected: Layer[], exported: T[], matches: (layer: Layer, item: T) => boolean) =>
    expected.length === exported.length && expected.every((layer, i) => matches(layer, exported[i]!));
  const entry = ctx.entry;

  const ringMatches = (layer: Layer, ring: unknown) =>
    Array.isArray(ring) &&
    colourMatches(ring[0], layer.color, layer.alpha) &&
    same(ring[1], layer.spread ?? 0);
  if (!inOrder(rings, listOf(entry.rings), ringMatches)) {
    ctx.problems.push(
      `${at}: the style's rings are ${JSON.stringify(rings)}, the export has ${JSON.stringify(entry.rings ?? [])}`,
    );
  }
  const shadowMatches = (layer: Layer, shadow: unknown) =>
    isObject(shadow) &&
    same(shadow.x, layer.x) &&
    same(shadow.y, layer.y) &&
    same(shadow.blur, layer.blur) &&
    same(shadow.spread, layer.spread ?? 0) &&
    shadow.inset === (layer.type === "INNER_SHADOW") &&
    colourMatches(shadow.color, layer.color, layer.alpha ?? 1);
  if (!inOrder(shadows, listOf(entry.shadows), shadowMatches)) {
    ctx.problems.push(
      `${at}: the style's shadows are ${JSON.stringify(shadows)}, the export has ${JSON.stringify(entry.shadows ?? [])}`,
    );
  }
}

function checkToken(ctx: Context, field: string, token: unknown) {
  const at = `${ctx.where}: tokens.${field}`;
  if (field === "text") {
    checkText(ctx, at, token);
    return;
  }
  if (field === "effect") {
    checkEffect(ctx, at, token);
    return;
  }
  if (!(field in READ)) {
    ctx.problems.push(`${at}: the export has no ${field} for the checker to read`);
    return;
  }
  if (typeof token === "string" || (SIDED.has(field) && Array.isArray(token))) {
    checkValue(ctx, at, field, token);
    return;
  }
  ctx.problems.push(`${at} is not a name`);
}

// The problems with one export, and the paint styles and opacities it couldn't measure.
export function checkExport(file: string, exported: Json, snapshot: Snapshot) {
  const problems: string[] = [];
  const notMeasured: string[] = [];
  const format2 = typeof exported.format === "number" && exported.format >= 2;
  for (const { where, entry, tokens } of entriesWithTokens(file, exported)) {
    const filled = withDefaults(entry, format2);
    const ctx: Context = { where, entry: filled, text: textOf(filled), snapshot, problems, notMeasured };
    for (const [field, token] of Object.entries(tokens)) checkToken(ctx, field, token);
  }
  return { problems, notMeasured };
}

const folder = new URL("<PATH TO EXPORTS FOLDER>/", import.meta.url);
const snapshot = readSnapshot(
  JSON.parse(readFileSync(new URL("tokens.json", folder), "utf8")) as SnapshotFile,
);

// The export files: <name>.json, not the lint, motion or ignore files.
const exports = readdirSync(folder).filter(
  (file) =>
    file.endsWith(".json") &&
    !/-(lint|motion)\.json$/.test(file) &&
    !["lint-ignore.json", "tokens.json"].includes(file),
);

for (const file of exports) {
  test(`${file}: every token agrees with the token snapshot`, () => {
    const exported = JSON.parse(readFileSync(new URL(file, folder), "utf8")) as Json;
    const { problems, notMeasured } = checkExport(file, exported, snapshot);
    for (const description of notMeasured)
      test.info().annotations.push({ type: "figma: not measured", description });
    expect(problems, `${file}: tokens that disagree with the snapshot`).toEqual([]);
  });
}

// The checker itself, on hand-made exports and snapshots: each rule fails when it should.
const fixture = readSnapshot({
  Colors: {
    "blue/600": { value: "#155dfc", web: "var(--color-blue-600)" },
    surface: { value: "#ffffff", web: "var(--color-surface)", modes: { Dark: "#101828" } },
  },
  Spacing: { "spacing/2": { value: 8, web: "calc(var(--spacing) * 2)" } },
  Sizing: { "size/80": { value: 320, web: "calc(var(--spacing) * 80)" } },
  Border: { "border-width/default": { value: 1, web: "1px" } },
  Opacity: { "opacity/50": { value: 0.5, web: "var(--opacity-50)" } },
  Typography: {
    "font/sans": { value: "Inter", web: "var(--font-sans)" },
    "font-weight/semibold": { value: 600, web: "var(--font-weight-semibold)" },
    "text/sm": { value: 14, web: "var(--text-sm)" },
    "text/sm--line-height": { value: 20, web: "var(--text-sm--line-height)" },
  },
  textStyles: {
    "text-sm/semibold": {
      family: "Inter",
      style: "Semi Bold",
      size: 14,
      lineHeight: 20,
      weight: 600,
      letterSpacing: 0,
      textCase: "none",
      textDecoration: "none",
    },
    "text-sm/null": { family: "Inter", style: "Regular", size: 14, lineHeight: 20, weight: null },
  },
  effectStyles: {
    "shadow-md": [{ type: "DROP_SHADOW", x: 0, y: 4, blur: 6, spread: -1, color: "#000000", alpha: 0.1 }],
    "focus-ring": [{ type: "DROP_SHADOW", x: 0, y: 0, blur: 0, spread: 2, color: "#155dfc", alpha: 1 }],
    "blur-md": [{ type: "LAYER_BLUR", blur: 8 }],
    nothing: [{ type: "INNER_SHADOW", x: 0, y: 0, blur: 0, spread: 0, color: "#000000", alpha: 1 }],
  },
} as SnapshotFile);
const staleFixture = readSnapshot({
  Colors: { "blue/600": { value: "#155dfd", web: "var(--color-blue-600)" } },
} as SnapshotFile);

const exportOf = (variants: Json, format?: number): Json => {
  const exported: Json = { node: "1:1", variants };
  if (format !== undefined) exported.format = format;
  return exported;
};
const problemsOf = (entry: Json, format?: number, snap: Snapshot = fixture) =>
  checkExport("fixture.json", exportOf({ Button: entry }, format), snap).problems;
const textEntry = (tokens: Json, extra: Json = {}): Json => ({
  type: "TEXT",
  fontFamily: "Inter",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 20,
  color: "#ffffff",
  ...extra,
  tokens,
});

test.describe("the checker", () => {
  test("an export with no tokens passes untouched, with or without a format", () => {
    expect(problemsOf({ fill: "#155dfc", width: 100 })).toEqual([]);
    expect(problemsOf({ fill: "#155dfc", width: 100 }, 2)).toEqual([]);
  });

  test("a token naming a variable the snapshot lacks fails, naming the export, entry and field", () => {
    const problems = problemsOf({ fill: "#155dfc", tokens: { fill: "var(--color-red-500)" } });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("fixture.json variants > Button: tokens.fill");
    expect(problems[0]).toContain("var(--color-red-500)");
  });

  test("a bare name that is no variable, text style or effect style fails", () => {
    expect(problemsOf({ width: 100, tokens: { width: "size/nine" } })).toHaveLength(1);
    expect(problemsOf({ tokens: { text: "text-sm/missing" } })).toHaveLength(1);
    expect(problemsOf({ tokens: { effect: "shadow-xl" } })).toHaveLength(1);
  });

  test("a paint style is not measured, never a failure", () => {
    const { problems, notMeasured } = checkExport(
      "fixture.json",
      exportOf({ Button: { fill: "#155dfc", tokens: { fill: "Brand/Primary" } } }),
      fixture,
    );
    expect(problems).toEqual([]);
    expect(notMeasured).toHaveLength(1);
    expect(notMeasured[0]).toContain("Brand/Primary");
  });

  test("an opacity token is not measured", () => {
    const { problems, notMeasured } = checkExport(
      "fixture.json",
      exportOf({ Button: { opacity: 0.5, tokens: { opacity: "opacity/50" } } }),
      fixture,
    );
    expect(problems).toEqual([]);
    expect(notMeasured).toHaveLength(1);
  });

  test("a stale snapshot whose colour differs by one channel fails", () => {
    const problems = problemsOf(
      { fill: "#155dfc", tokens: { fill: "var(--color-blue-600)" } },
      undefined,
      staleFixture,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("#155dfd");
  });

  test("a colour's alpha is the paint's own, not compared", () => {
    expect(problemsOf({ fill: "#155dfc80", tokens: { fill: "var(--color-blue-600)" } })).toEqual([]);
  });

  test("a colour with the variable's mode matches", () => {
    expect(problemsOf({ fill: "#101828", tokens: { fill: "var(--color-surface)" } })).toEqual([]);
    expect(problemsOf({ fill: "#202020", tokens: { fill: "var(--color-surface)" } })).toHaveLength(1);
  });

  test("a bare web name (1px) resolves to its variable", () => {
    expect(problemsOf({ stroke: "#155dfc", strokeWeight: 1, tokens: { strokeWeight: "1px" } })).toEqual([]);
  });

  test("padding is checked side by side, and a side with no token is skipped", () => {
    const tokens = {
      padding: ["calc(var(--spacing) * 2)", null, "calc(var(--spacing) * 2)", "calc(var(--spacing) * 2)"],
    };
    expect(problemsOf({ layout: { padding: [8, 16, 8, 8] }, tokens })).toEqual([]);
    const problems = problemsOf({ layout: { padding: [8, 16, 8, 12] }, tokens });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("(left)");
  });

  test("a sized token on a box is checked against its width", () => {
    expect(problemsOf({ width: 320, tokens: { width: "calc(var(--spacing) * 80)" } })).toEqual([]);
    expect(problemsOf({ width: 300, tokens: { width: "calc(var(--spacing) * 80)" } })).toHaveLength(1);
  });

  test("a text style's null weight is skipped, a different weight fails", () => {
    const label = {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 20,
      letterSpacing: 0,
      textCase: "none",
      textDecoration: "none",
    };
    expect(problemsOf({ label, tokens: { text: "text-sm/null" } })).toEqual([]);
    expect(
      problemsOf({ label: { ...label, fontWeight: 500 }, tokens: { text: "text-sm/semibold" } }),
    ).toHaveLength(1);
  });

  test("a format-2 label gets its text defaults, and a text style checks them", () => {
    const label = { fontFamily: "Inter", fontSize: 14, fontWeight: 600, lineHeight: 20 };
    expect(problemsOf({ label, tokens: { text: "text-sm/semibold" } }, 2)).toEqual([]);
    expect(
      problemsOf({ label: { ...label, textCase: "uppercase" }, tokens: { text: "text-sm/semibold" } }, 2),
    ).toHaveLength(1);
    expect(
      problemsOf({ label: { ...label, letterSpacing: 1 }, tokens: { text: "text-sm/semibold" } }, 2),
    ).toHaveLength(1);
  });

  test("a format-2 label that is null gets no defaults, and a text token on it fails", () => {
    expect(problemsOf({ label: null, tokens: { text: "text-sm/semibold" } }, 2)).toHaveLength(1);
  });

  test("a TEXT entry on a page gets its own defaults and checks against its style", () => {
    expect(problemsOf(textEntry({ text: "text-sm/semibold" }), 2)).toEqual([]);
    expect(problemsOf(textEntry({ text: "text-sm/semibold" }, { fontFamily: "Arial" }), 2)).toHaveLength(1);
  });

  test("a shadow matches its layer, its alpha to the byte", () => {
    const shadows = [{ x: 0, y: 4, blur: 6, spread: -1, color: "#0000001a", inset: false }];
    expect(problemsOf({ shadows, tokens: { effect: "shadow-md" } })).toEqual([]);
    const wrongAlpha = [{ ...shadows[0]!, color: "#00000080" }];
    expect(problemsOf({ shadows: wrongAlpha, tokens: { effect: "shadow-md" } })).toHaveLength(1);
  });

  test("a ring matches the style's ring, and a shadow that draws nothing is left out", () => {
    expect(problemsOf({ rings: [["#155dfc", 2]], tokens: { effect: "focus-ring" } })).toEqual([]);
    expect(problemsOf({ tokens: { effect: "nothing" } })).toEqual([]);
  });

  test("a blur-only style has no shadows to match", () => {
    expect(problemsOf({ tokens: { effect: "blur-md" } })).toEqual([]);
  });

  test("a format-2 entry without shadows has none, so a shadow style fails", () => {
    expect(problemsOf({ tokens: { effect: "shadow-md" } }, 2)).toHaveLength(1);
  });
});
