// Runs export-node against a fake Figma document: `node --test "figma-flow/scripts/*.test.ts"`, from the repo root.
// The script runs inside Figma, so here it gets a stand-in `figma` global with just the nodes
// and fields it reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

type Fake = Record<string, unknown> & { id: string; type: string; children?: Fake[] };

const source = readFileSync(new URL("./export-node.ts", import.meta.url), "utf8");
const body = stripTypeScriptTypes(source).replace(/^export default /m, "");
// The variables and styles the file can resolve by id; anything not listed resolves to null.
type Library = {
  variables?: Record<string, { name: string; codeSyntax: { WEB?: string } } | null>;
  styles?: Record<string, { name: string }>;
};
const mixed = Symbol("mixed");
const runIn = (library: Library, nodes: Fake[], ids: string[]): Promise<string> => {
  const byId = new Map<string, Fake>();
  const index = (node: Fake) => {
    byId.set(node.id, node);
    node.children?.forEach(index);
  };
  nodes.forEach(index);
  const figma = {
    mixed,
    fileKey: "FILE",
    getNodeByIdAsync: async (id: string) => byId.get(id) ?? null,
    variables: { getVariableByIdAsync: async (id: string) => library.variables?.[id] ?? null },
    getStyleByIdAsync: async (id: string) => library.styles?.[id] ?? null,
  };
  return new Function("figma", `${body}\nreturn exportNode(...${JSON.stringify(ids)});`)(figma);
};
const run = (nodes: Fake[], ...ids: string[]): Promise<string> => runIn({}, nodes, ids);

const white = [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 } }];
const black = [{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0 } }];
// Figma's defaults for every field the script reads, so a test only states what it is about.
const box = (id: string, type: string, name: string, extra: Partial<Fake> = {}): Fake => ({
  id, type, name, visible: true, x: 0, y: 0, width: 100, height: 40, fills: [], strokes: [], strokeWeight: 1,
  cornerRadius: 0, effects: [], layoutMode: "VERTICAL", itemSpacing: 8, paddingTop: 0, paddingRight: 0,
  paddingBottom: 0, paddingLeft: 0, strokesIncludedInLayout: false, children: [],
  opacity: 1, strokeAlign: "INSIDE", dashPattern: [], primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
  layoutWrap: "NO_WRAP", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
  minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, counterAxisSpacing: null,
  boundVariables: {}, effectStyleId: "", fillStyleId: "", strokeStyleId: "",
  topLeftRadius: 0, topRightRadius: 0, bottomRightRadius: 0, bottomLeftRadius: 0,
  strokeTopWeight: 1, strokeRightWeight: 1, strokeBottomWeight: 1, strokeLeftWeight: 1, ...extra,
});
const text = (id: string, characters: string, extra: Partial<Fake> = {}): Fake => ({
  id, type: "TEXT", name: characters, characters, visible: true, x: 0, y: 0, width: 80, height: 20,
  fills: white, fontSize: 14, fontWeight: 400, lineHeight: { unit: "PIXELS", value: 20 },
  textAutoResize: "WIDTH_AND_HEIGHT", opacity: 1, letterSpacing: { unit: "PERCENT", value: 0 }, textCase: "ORIGINAL",
  textDecoration: "NONE", textAlignHorizontal: "LEFT", fontName: { family: "Inter", style: "Regular" },
  boundVariables: {}, fillStyleId: "", textStyleId: "", ...extra,
});
const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });
const frame = (id: string, children: Fake[]) => box(id, "FRAME", "Page", { children });
// An instance whose text is inside a nested frame, as TextField's is, with a text property.
const textField = (id: string, label: string, y: number): Fake => {
  const main = { name: "state=default, invalid=false", remote: true, parent: { type: "COMPONENT_SET", name: "TextField" } };
  return box(id, "INSTANCE", "TextField", {
    y,
    // The description comes first, both as a property and as a direct text child; the key uses the label.
    componentProperties: {
      "description#1:1": { type: "TEXT", value: "Help" },
      "label#1:0": { type: "TEXT", value: label },
      state: { type: "VARIANT", value: "default" },
    },
    getMainComponentAsync: async () => main,
    children: [text(`${id}.3`, "Help"), box(`${id}.1`, "FRAME", "Field", { children: [text(`${id}.2`, label)] })],
  });
};
const parse = (out: string) => JSON.parse(out).variants as Record<string, Record<string, unknown>>;
const keysInText = (out: string) => [...out.matchAll(/^ {4}("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1]!));

test("a frame is a page: frames and text all the way down, instances as one entry each", async () => {
  const page = box("1:1", "FRAME", "Report", {
    fills: white,
    children: [
      box("1:2", "FRAME", "Card", {
        x: 416, y: 48, layoutMode: "VERTICAL",
        children: [
          box("1:3", "FRAME", "Header", { children: [text("1:4", "Report an injury", { fontSize: 18 }), text("1:5", "Step 1 of 3")] }),
          textField("1:6", "Date of injury", 100),
          textField("1:7", "Employer", 200),
        ],
      }),
    ],
  });
  const out = await run([page], "1:1");
  const nodes = parse(out);
  assert.deepEqual(Object.keys(nodes), [
    "Report",
    "Report > Card",
    "Report > Card > Header",
    "Report > Card > Header > Report an injury",
    "Report > Card > Header > Step 1 of 3",
    "Report > Card > Date of injury",
    "Report > Card > Employer",
  ]);
  // Instances are named by their text property, and nothing inside them is exported.
  assert.equal(nodes["Report > Card > Employer"]!.component, "TextField");
  assert.equal(nodes["Report > Card > Employer"]!.id, "1:7");
  assert.equal(nodes["Report > Card > Employer"]!.y, 200);
  // Text has an entry of its own, with its type; frames carry no label on a page.
  assert.equal(nodes["Report > Card > Header > Report an injury"]!.fontSize, 18);
  assert.equal(nodes["Report > Card > Header > Report an injury"]!.type, "TEXT");
  assert.equal(nodes["Report > Card > Header"]!.label, null);
  // Each entry names its parent entry; positions are inside it.
  assert.equal(nodes["Report > Card > Header"]!.parent, "Report > Card");
  assert.equal(nodes["Report > Card"]!.x, 416);
  assert.equal(nodes["Report"]!.parent, null);
});

test("repeated keys are numbered, so nothing is lost when the JSON is read", async () => {
  const row = (id: string) => box(id, "INSTANCE", "ClaimRow", {
    componentProperties: {}, getMainComponentAsync: async () => ({ name: "ClaimRow", remote: true, parent: { type: "PAGE" } }),
  });
  const page = box("2:1", "FRAME", "Inbox", { children: [row("2:2"), row("2:3"), row("2:4"), text("2:5", "Open"), text("2:6", "Open")] });
  const out = await run([page], "2:1");
  const written = keysInText(out);
  assert.deepEqual(written, ["Inbox", "Inbox > ClaimRow", "Inbox > ClaimRow (2)", "Inbox > ClaimRow (3)", "Inbox > Open", "Inbox > Open (2)"]);
  assert.equal(Object.keys(parse(out)).length, written.length);
  assert.deepEqual(Object.values(parse(out)).map((n) => n.id), ["2:1", "2:2", "2:3", "2:4", "2:5", "2:6"]);
});

test("components keep their shape: variants, and laid-out children one level down", async () => {
  const variant = (id: string, name: string) =>
    box(id, "COMPONENT", name, { layoutMode: "HORIZONTAL", children: [text(`${id}.t`, "Button")] });
  const set = { id: "3:1", type: "COMPONENT_SET", name: "Button", children: [variant("3:2", "variant=default"), variant("3:3", "variant=outline")] };
  const tabs = box("4:1", "COMPONENT", "TabList", {
    layoutMode: "HORIZONTAL",
    children: [box("4:2", "INSTANCE", "Tab", { children: [text("4:3", "Tab")] }), box("4:4", "INSTANCE", "Tab", { children: [text("4:5", "Tab")] })],
  });
  const buttons = parse(await run([set as Fake], "3:1"));
  assert.deepEqual(Object.keys(buttons), ["variant=default", "variant=outline"]);
  assert.equal(buttons["variant=default"]!.label && (buttons["variant=default"]!.label as { fontSize: number }).fontSize, 14);
  // Two children labelled "Tab" no longer overwrite each other.
  assert.deepEqual(Object.keys(parse(await run([tabs], "4:1"))), ["TabList", "TabList > Tab", "TabList > Tab (2)"]);
});

test("an instance of a component made in this file is opened; a library one isn't", async () => {
  const badge = box("6:4", "INSTANCE", "Badge", {
    componentProperties: { "Label#1:0": { type: "TEXT", value: "Approved" } },
    getMainComponentAsync: async () => ({ name: "color=green", remote: true, parent: { type: "COMPONENT_SET", name: "Badge" } }),
    children: [text("6:5", "Approved")],
  });
  const row = box("6:2", "INSTANCE", "ClaimRow", {
    componentProperties: { "title#1:0": { type: "TEXT", value: "WC-2038" } },
    getMainComponentAsync: async () => ({ name: "ClaimRow", remote: false, parent: { type: "PAGE" } }),
    children: [text("6:3", "WC-2038"), badge],
  });
  const nodes = parse(await run([box("6:1", "FRAME", "Inbox", { children: [row] })], "6:1"));
  assert.deepEqual(Object.keys(nodes), ["Inbox", "Inbox > WC-2038", "Inbox > WC-2038 > WC-2038", "Inbox > WC-2038 > Approved"]);
  assert.equal(nodes["Inbox > WC-2038"]!.local, true);
  assert.equal(nodes["Inbox > WC-2038"]!.label, null);
  assert.equal(nodes["Inbox > WC-2038 > Approved"]!.local, false);
  assert.equal(nodes["Inbox > WC-2038 > Approved"]!.parent, "Inbox > WC-2038");
});

test("the last line is a hash of everything above it", async () => {
  const out = await run([box("5:1", "FRAME", "Empty")], "5:1");
  const at = out.lastIndexOf('  "hash"');
  let hash = 5381;
  for (let i = 0; i < at; i++) hash = ((hash * 33) ^ out.charCodeAt(i)) >>> 0;
  assert.equal(JSON.parse(out).hash, hash.toString(16));
});

// A group has no entry of its own; its children take the entry above it as parent.
const group = (id: string, name: string, children: Fake[], extra: Partial<Fake> = {}): Fake =>
  ({ id, type: "GROUP", name, visible: true, x: 0, y: 0, children, ...extra });

test("a group is walked through: its text takes the frame as parent", async () => {
  const page = box("7:1", "FRAME", "Report", { children: [group("7:2", "Row", [text("7:3", "Hello", { x: 12, y: 8 })], { x: 30, y: 50 })] });
  const nodes = parse(await run([page], "7:1"));
  assert.deepEqual(Object.keys(nodes), ["Report", "Report > Hello"]);
  assert.equal(nodes["Report > Hello"]!.parent, "Report");
  assert.equal(nodes["Report > Hello"]!.type, "TEXT");
  assert.equal(nodes["Report > Hello"]!.x, 12);
  assert.equal(nodes["Report > Hello"]!.y, 8);
});

test("nested groups and frames under groups are walked; a hidden group's subtree is skipped", async () => {
  const card = box("8:4", "FRAME", "Card", { children: [text("8:5", "Hello", { x: 4 })] });
  const page = box("8:1", "FRAME", "Report", {
    children: [
      group("8:2", "Outer", [group("8:3", "Inner", [card])]),
      group("8:6", "Hidden", [text("8:7", "Secret")], { visible: false }),
    ],
  });
  const nodes = parse(await run([page], "8:1"));
  assert.deepEqual(Object.keys(nodes), ["Report", "Report > Card", "Report > Card > Hello"]);
  assert.equal(nodes["Report > Card"]!.parent, "Report");
  assert.equal(nodes["Report > Card > Hello"]!.parent, "Report > Card");
  assert.equal(nodes["Report > Card > Hello"]!.x, 4);
});

test("a group inside a local instance is walked too", async () => {
  const row = box("9:2", "INSTANCE", "ClaimRow", {
    componentProperties: { "title#1:0": { type: "TEXT", value: "WC-2038" } },
    getMainComponentAsync: async () => ({ name: "ClaimRow", remote: false, parent: { type: "PAGE" } }),
    children: [group("9:3", "Details", [text("9:4", "Open", { x: 10 })])],
  });
  const nodes = parse(await run([box("9:1", "FRAME", "Inbox", { children: [row] })], "9:1"));
  assert.deepEqual(Object.keys(nodes), ["Inbox", "Inbox > WC-2038", "Inbox > WC-2038 > Open"]);
  assert.equal(nodes["Inbox > WC-2038 > Open"]!.parent, "Inbox > WC-2038");
  assert.equal(nodes["Inbox > WC-2038 > Open"]!.x, 10);
});

test("A1: a box records opacity, shadows, sizing, min and max, and a stroke's align and dash", async () => {
  const card = box("10:2", "FRAME", "Card", {
    opacity: 0.5, strokes: white, strokeWeight: 2, strokeAlign: "OUTSIDE", dashPattern: [4, 2],
    effects: [
      { type: "DROP_SHADOW", visible: true, radius: 8, spread: -2, offset: { x: 0, y: 4 }, color: { r: 0, g: 0, b: 0, a: 0.25 } },
      { type: "INNER_SHADOW", visible: true, radius: 2, spread: 0, offset: { x: 0, y: 1 }, color: { r: 1, g: 1, b: 1, a: 1 } },
    ],
    layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", minWidth: 0, maxWidth: 320,
  });
  const entry = parse(await run([frame("10:1", [card])], "10:1"))["Page > Card"]!;
  assert.equal(entry.opacity, 0.5);
  assert.deepEqual(entry.shadows, [
    { x: 0, y: 4, blur: 8, spread: -2, color: "#00000040", inset: false },
    { x: 0, y: 1, blur: 2, spread: 0, color: "#ffffff", inset: true },
  ]);
  assert.deepEqual(entry.sizing, ["fill", "hug"]);
  // Zero is a set minimum; null is not set, so it is left out.
  assert.equal(entry.minWidth, 0);
  assert.equal(entry.maxWidth, 320);
  assert.equal("minHeight" in entry, false);
  assert.equal("maxHeight" in entry, false);
  assert.equal(entry.strokeAlign, "outside");
  assert.equal(entry.dashed, true);
});

test("A1: a spread-only shadow is a ring, and a shadow with blur is not", async () => {
  const ring = box("12:2", "FRAME", "Ring", {
    effects: [{ type: "DROP_SHADOW", visible: true, radius: 0, spread: 2, offset: { x: 0, y: 0 }, color: { r: 0, g: 0.4, b: 1, a: 1 } }],
  });
  const entry = parse(await run([frame("12:1", [ring])], "12:1"))["Page > Ring"]!;
  assert.deepEqual(entry.rings, [["#0066ff", 2]]);
  assert.deepEqual(entry.shadows, []);
});

test("A1 hostile: a hidden shadow or ring is left out, and a dash needs a stroke", async () => {
  const hidden = box("11:2", "FRAME", "Hidden", {
    effects: [
      { type: "DROP_SHADOW", visible: false, radius: 4, spread: 0, offset: { x: 0, y: 1 }, color: { r: 0, g: 0, b: 0, a: 1 } },
      { type: "DROP_SHADOW", visible: false, radius: 0, spread: 2, offset: { x: 0, y: 0 }, color: { r: 0, g: 0, b: 0, a: 1 } },
    ],
  });
  const noStroke = box("11:3", "FRAME", "NoStroke", { dashPattern: [4, 2], strokeAlign: "OUTSIDE" });
  const centred = box("11:4", "FRAME", "Centred", { strokes: black, strokeAlign: "CENTER" });
  const nodes = parse(await run([frame("11:1", [hidden, noStroke, centred])], "11:1"));
  assert.deepEqual(nodes["Page > Hidden"]!.shadows, []);
  assert.deepEqual(nodes["Page > Hidden"]!.rings, []);
  assert.equal("dashed" in nodes["Page > NoStroke"]!, false);
  assert.equal("strokeAlign" in nodes["Page > NoStroke"]!, false);
  assert.equal(nodes["Page > Centred"]!.strokeAlign, "center");
  assert.equal("dashed" in nodes["Page > Centred"]!, false);
});

test("A2: a see-through colour is #rrggbbaa; opaque, and 0.999 (which rounds to 255), are #rrggbb", async () => {
  const see = box("13:2", "FRAME", "See", { fills: [{ type: "SOLID", visible: true, opacity: 0.5, color: { r: 1, g: 1, b: 1 } }] });
  const undef = box("13:3", "FRAME", "Undefined", { fills: [{ type: "SOLID", visible: true, opacity: undefined, color: { r: 1, g: 1, b: 1 } }] });
  const almost = box("13:4", "FRAME", "Almost", {
    fills: [{ type: "SOLID", visible: true, opacity: 0.999, color: { r: 1, g: 1, b: 1 } }],
    effects: [{ type: "DROP_SHADOW", visible: true, radius: 4, spread: 0, offset: { x: 0, y: 1 }, color: { r: 0, g: 0, b: 0, a: 0.999 } }],
  });
  const ring = box("13:5", "FRAME", "Ring", {
    effects: [{ type: "DROP_SHADOW", visible: true, radius: 0, spread: 1, offset: { x: 0, y: 0 }, color: { r: 0, g: 0, b: 0, a: 0.5 } }],
  });
  const nodes = parse(await run([frame("13:1", [see, undef, almost, ring])], "13:1"));
  assert.equal(nodes["Page > See"]!.fill, "#ffffff80");
  assert.equal(nodes["Page > Undefined"]!.fill, "#ffffff");
  assert.equal(nodes["Page > Almost"]!.fill, "#ffffff");
  assert.equal((nodes["Page > Almost"]!.shadows as { color: string }[])[0]!.color, "#000000");
  assert.deepEqual(nodes["Page > Ring"]!.rings, [["#00000080", 1]]);
});

test("A3: radius and stroke weight are one number when the sides agree, and four when they differ", async () => {
  const even = box("14:2", "FRAME", "Even", { cornerRadius: 8, strokes: black, strokeWeight: 2 });
  const uneven = box("14:3", "FRAME", "Uneven", {
    cornerRadius: mixed, topLeftRadius: 4, topRightRadius: 4, bottomRightRadius: 0, bottomLeftRadius: 0,
    strokes: black, strokeWeight: mixed, strokeTopWeight: 1, strokeRightWeight: 2, strokeBottomWeight: 1, strokeLeftWeight: 0,
  });
  const unstroked = box("14:4", "FRAME", "Unstroked", { strokes: [], strokeWeight: 2 });
  const nodes = parse(await run([frame("14:1", [even, uneven, unstroked])], "14:1"));
  assert.equal(nodes["Page > Even"]!.radius, 8);
  assert.equal(nodes["Page > Even"]!.strokeWeight, 2);
  assert.deepEqual(nodes["Page > Uneven"]!.radius, [4, 4, 0, 0]);
  assert.deepEqual(nodes["Page > Uneven"]!.strokeWeight, [1, 2, 1, 0]);
  // No stroke, so no weight, whatever the node's stroke weight says.
  assert.equal(nodes["Page > Unstroked"]!.strokeWeight, 0);
});

test("A4: a label and a page's text record their type; letter spacing is px, and alignment needs a set width", async () => {
  const label = text("15:3", "Email", {
    fontName: { family: "Inter", style: "Medium" }, fontWeight: 500,
    letterSpacing: { unit: "PERCENT", value: 5 }, textCase: "UPPER", textDecoration: "UNDERLINE",
  });
  const input = box("15:2", "COMPONENT", "Input", { children: [label] });
  const component = parse(await run([input], "15:2"));
  assert.deepEqual(component["Input"]!.label, {
    x: 0, y: 0, height: 20, color: "#ffffff", fontFamily: "Inter", fontSize: 14, fontWeight: 500, lineHeight: 20,
    letterSpacing: 0.7, textCase: "uppercase", textDecoration: "underline",
  });
  const hint = text("15:4", "Hint", {
    textAutoResize: "HEIGHT", textAlignHorizontal: "CENTER", opacity: 0.5, letterSpacing: { unit: "PIXELS", value: 1.23456 },
    textCase: "SMALL_CAPS", textDecoration: "STRIKETHROUGH",
  });
  const justified = text("15:5", "Body", { textAutoResize: "HEIGHT", textAlignHorizontal: "JUSTIFIED" });
  const page = parse(await run([frame("15:1", [hint, justified])], "15:1"));
  assert.deepEqual(
    {
      fontFamily: page["Page > Hint"]!.fontFamily, letterSpacing: page["Page > Hint"]!.letterSpacing,
      textCase: page["Page > Hint"]!.textCase, textDecoration: page["Page > Hint"]!.textDecoration,
      textAlign: page["Page > Hint"]!.textAlign, opacity: page["Page > Hint"]!.opacity,
    },
    { fontFamily: "Inter", letterSpacing: 1.23, textCase: "small-caps", textDecoration: "line-through", textAlign: "center", opacity: 0.5 },
  );
  assert.equal(page["Page > Body"]!.textAlign, "justify");
  // A text that hugs its words has no width to align in.
  assert.equal("textAlign" in component["Input"]!.label!, false);
  assert.equal("textAlign" in parse(await run([frame("15:6", [text("15:7", "Hug")])], "15:6"))["Page > Hug"]!, false);
});

test("A4 hostile: a mixed type value is null, and percent spacing with a mixed size is null", async () => {
  const mixedText = text("16:2", "Mixed", { fontName: mixed, fontSize: mixed, letterSpacing: { unit: "PERCENT", value: 5 }, textCase: mixed, textDecoration: mixed });
  const mixedSpacing = text("16:3", "Spacing", { letterSpacing: mixed });
  const nodes = parse(await run([frame("16:1", [mixedText, mixedSpacing])], "16:1"));
  assert.deepEqual(
    [nodes["Page > Mixed"]!.fontFamily, nodes["Page > Mixed"]!.fontSize, nodes["Page > Mixed"]!.letterSpacing, nodes["Page > Mixed"]!.textCase, nodes["Page > Mixed"]!.textDecoration],
    [null, null, null, null, null],
  );
  assert.equal(nodes["Page > Spacing"]!.letterSpacing, null);
});

test("A5: layout records justify, align and wrap, in CSS's words", async () => {
  const pair = (id: string, name: string, extra: Partial<Fake>) =>
    box(id, "COMPONENT", name, { layoutMode: "HORIZONTAL", children: [box(`${id}.a`, "FRAME", "A"), box(`${id}.b`, "FRAME", "B")], ...extra });
  const spread = parse(await run([pair("17:1", "Row", { primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER", layoutWrap: "WRAP", counterAxisSpacing: 12 })], "17:1"));
  assert.deepEqual(spread["Row"]!.layout, { direction: "row", gap: 8, padding: [0, 0, 0, 0], justify: "space-between", align: "center", wrap: true, rowGap: 12 });
  const column = parse(await run([pair("17:2", "Column", { layoutMode: "VERTICAL", primaryAxisAlignItems: "MAX", counterAxisAlignItems: "BASELINE" })], "17:2"));
  assert.deepEqual(column["Column"]!.layout, { direction: "column", gap: 8, padding: [0, 0, 0, 0], justify: "end", align: "baseline" });
});

test("A5: a child that fills an axis takes it, so justify and align are left out", async () => {
  const filled = box("18:1", "COMPONENT", "Fill", {
    layoutMode: "HORIZONTAL",
    children: [
      box("18:2", "FRAME", "A", { layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" }),
      box("18:3", "FRAME", "B", { layoutSizingVertical: "FILL" }),
    ],
  });
  const layout = parse(await run([filled], "18:1"))["Fill"]!.layout;
  assert.deepEqual(layout, { direction: "row", gap: 8, padding: [0, 0, 0, 0] });
});

test("A6: a bound value is named by its web syntax or its name, and a style by its name", async () => {
  const library: Library = {
    variables: {
      "v:blue": { name: "blue/600", codeSyntax: { WEB: "var(--color-blue-600)" } },
      "v:space": { name: "spacing/4", codeSyntax: {} },
      "v:radius": { name: "radius/md", codeSyntax: { WEB: "var(--radius-md)" } },
    },
    styles: { "s:card": { name: "card/surface" }, "s:shadow": { name: "shadow-md" } },
  };
  const blue = [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 }, boundVariables: { color: alias("v:blue") } }];
  const card = box("20:2", "FRAME", "Card", {
    layoutMode: "VERTICAL", itemSpacing: 4, paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 8,
    cornerRadius: 8, topLeftRadius: 8, topRightRadius: 8, bottomRightRadius: 8, bottomLeftRadius: 8,
    fills: blue, fillStyleId: "s:card", strokes: blue, effectStyleId: "s:shadow",
    boundVariables: {
      itemSpacing: alias("v:space"), paddingTop: alias("v:space"), paddingRight: alias("v:space"), paddingBottom: alias("v:space"), paddingLeft: alias("v:space"),
      topLeftRadius: alias("v:radius"), topRightRadius: alias("v:radius"), bottomRightRadius: alias("v:radius"), bottomLeftRadius: alias("v:radius"),
    },
  });
  const partial = box("20:3", "FRAME", "Partial", {
    boundVariables: { topLeftRadius: alias("v:radius"), topRightRadius: alias("v:radius"), bottomRightRadius: alias("v:radius") },
  });
  const nodes = parse(await runIn(library, [frame("20:1", [card, partial])], ["20:1"]));
  assert.deepEqual(nodes["Page > Card"]!.tokens, {
    fill: "card/surface", stroke: "var(--color-blue-600)", radius: "var(--radius-md)", gap: "spacing/4", padding: "spacing/4", effect: "shadow-md",
  });
  // Four corners that don't all share a variable: one name each, null for the one that has none.
  assert.deepEqual(nodes["Page > Partial"]!.tokens, { radius: ["var(--radius-md)", "var(--radius-md)", "var(--radius-md)", null] });
});

test("A6 hostile: an unresolved variable is left out, and a style id of mixed or empty falls back to the variable", async () => {
  const library: Library = { variables: { "v:blue": { name: "blue/600", codeSyntax: { WEB: "var(--color-blue-600)" } }, "v:gone": null } };
  const blue = [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 }, boundVariables: { color: alias("v:blue") } }];
  const missing = box("21:2", "FRAME", "Missing", { fills: blue, fillStyleId: mixed, boundVariables: { itemSpacing: alias("v:gone") } });
  const empty = box("21:3", "FRAME", "Empty", { fills: blue, fillStyleId: "" });
  const gone = box("21:4", "FRAME", "Gone", { boundVariables: { itemSpacing: alias("v:gone") } });
  const nodes = parse(await runIn(library, [frame("21:1", [missing, empty, gone])], ["21:1"]));
  assert.deepEqual(nodes["Page > Missing"]!.tokens, { fill: "var(--color-blue-600)" });
  assert.deepEqual(nodes["Page > Empty"]!.tokens, { fill: "var(--color-blue-600)" });
  assert.equal("tokens" in nodes["Page > Gone"]!, false);
});

test("A6: a label's text is named by its style, and per-run bindings give a name only when every run agrees", async () => {
  const library: Library = {
    variables: {
      "v:blue": { name: "blue/600", codeSyntax: { WEB: "var(--color-blue-600)" } },
      "v:size": { name: "text/sm", codeSyntax: { WEB: "var(--text-sm)" } },
      "v:weight": { name: "font-weight/semibold", codeSyntax: {} },
    },
    styles: { "s:text": { name: "text-sm/semibold" } },
  };
  const label = text("22:3", "Save", {
    textStyleId: "s:text",
    fills: [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 }, boundVariables: { color: alias("v:blue") } }],
    boundVariables: { fontSize: alias("v:size"), fontWeight: [alias("v:weight"), alias("v:weight")], lineHeight: [alias("v:size"), alias("v:weight")] },
  });
  const nodes = parse(await runIn(library, [box("22:2", "COMPONENT", "Button", { children: [label] })], ["22:2"]));
  assert.deepEqual(nodes["Button"]!.tokens, {
    text: "text-sm/semibold", textColor: "var(--color-blue-600)", fontSize: "var(--text-sm)", fontWeight: "font-weight/semibold",
  });
});
