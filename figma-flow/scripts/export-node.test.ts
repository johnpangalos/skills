// Runs export-node against a fake Figma document: `node --test figma-flow/scripts/`.
// The script runs inside Figma, so here it gets a stand-in `figma` global with just the nodes
// and fields it reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

type Fake = Record<string, unknown> & { id: string; type: string; children?: Fake[] };

const source = readFileSync(new URL("./export-node.ts", import.meta.url), "utf8");
const body = stripTypeScriptTypes(source).replace(/^export default /m, "");
const run = (nodes: Fake[], ...ids: string[]): Promise<string> => {
  const byId = new Map<string, Fake>();
  const index = (node: Fake) => {
    byId.set(node.id, node);
    node.children?.forEach(index);
  };
  nodes.forEach(index);
  const figma = { mixed: Symbol("mixed"), fileKey: "FILE", getNodeByIdAsync: async (id: string) => byId.get(id) ?? null };
  return new Function("figma", `${body}\nreturn exportNode(...${JSON.stringify(ids)});`)(figma);
};

const white = [{ type: "SOLID", visible: true, color: { r: 1, g: 1, b: 1 } }];
const box = (id: string, type: string, name: string, extra: Partial<Fake> = {}): Fake => ({
  id, type, name, visible: true, x: 0, y: 0, width: 100, height: 40, fills: [], strokes: [], strokeWeight: 1,
  cornerRadius: 0, effects: [], layoutMode: "VERTICAL", itemSpacing: 8, paddingTop: 0, paddingRight: 0,
  paddingBottom: 0, paddingLeft: 0, strokesIncludedInLayout: false, children: [], ...extra,
});
const text = (id: string, characters: string, extra: Partial<Fake> = {}): Fake => ({
  id, type: "TEXT", name: characters, characters, visible: true, x: 0, y: 0, width: 80, height: 20,
  fills: white, fontSize: 14, fontWeight: 400, lineHeight: { unit: "PIXELS", value: 20 },
  textAutoResize: "WIDTH_AND_HEIGHT", ...extra,
});
// An instance whose text is inside a nested frame, as TextField's is, with a text property.
const textField = (id: string, label: string, y: number): Fake => {
  const main = { name: "state=default, invalid=false", parent: { type: "COMPONENT_SET", name: "TextField" } };
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
    componentProperties: {}, getMainComponentAsync: async () => ({ name: "ClaimRow", parent: { type: "PAGE" } }),
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

test("the last line is a hash of everything above it", async () => {
  const out = await run([box("5:1", "FRAME", "Empty")], "5:1");
  const at = out.lastIndexOf('  "hash"');
  let hash = 5381;
  for (let i = 0; i < at; i++) hash = ((hash * 33) ^ out.charCodeAt(i)) >>> 0;
  assert.equal(JSON.parse(out).hash, hash.toString(16));
});
