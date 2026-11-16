import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  expectTextToMatchFigma,
  expectToMatchFigma,
  loadFigmaNodes,
  loadFigmaPage,
  nodesOf,
  type FigmaNode,
  type FigmaText,
} from "./figma";

// The helper, tested on values that aren't the defaults. Each element is drawn at a fixed size, so
// no font can move a box; the Figma nodes are written by hand, in the old shape (every field) and
// in format 2 (defaults left out), and both must pass.

type Json = Record<string, unknown>;
type Change = (node: FigmaNode) => FigmaNode;

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; }
  div, p, span, i { box-sizing: border-box; }
  .row { display: flex; width: 200px; height: 40px; }
</style>
</head>
<body>
  <div id="tinted" style="width: 200px; height: 120px; min-width: 100px; max-width: 300px; min-height: 40px; opacity: 0.5; background: rgba(168, 0, 183, 0.5); border: solid #111111; border-width: 1px 2px 3px 4px; border-radius: 4px 8px 12px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), inset 0 0 0 2px #ff0000, 0 0 0 3px #00ff00;"></div>
  <div id="dashed" style="width: 120px; height: 40px; border: 2px dashed #222222;"></div>
  <div id="outlined" style="width: 120px; height: 40px; outline: 2px solid #0000ff; outline-offset: 0;"></div>
  <div id="labelled" style="width: 160px; height: 36px; padding: 8px 16px; border-radius: 6px; background: #a800b7; color: #ffffff; font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; letter-spacing: 0.5px; text-transform: uppercase;"><span style="text-decoration: underline;">Save</span></div>
  <div id="small-caps" style="width: 160px; height: 36px; padding: 8px 16px; border-radius: 6px; background: #a800b7; color: #ffffff; font-family: Inter, sans-serif; font-size: 14px; font-weight: 600; line-height: 20px; font-variant-caps: small-caps; letter-spacing: normal;"><span>Save</span></div>
  <div id="placeholder" style="width: 120px; height: 40px; background: #ffffff; border-radius: 8px; box-shadow: 0 0 transparent, 0 2px 4px rgba(0, 0, 0, 0.2);"></div>
  <div id="flex" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; column-gap: 8px; row-gap: 6px; padding: 4px 8px; width: 200px; height: 60px;"><i style="width: 20px; height: 20px;"></i><i style="width: 30px; height: 10px;"></i><i style="width: 40px; height: 30px;"></i></div>
  <div id="column-stretch" style="display: flex; flex-direction: column; align-items: flex-start; width: 200px; height: 100px;"><div id="fill-child" style="align-self: stretch; height: 30px;"></div></div>
  <div id="column-short" style="display: flex; flex-direction: column; align-items: flex-start; width: 200px; height: 100px;"><div id="short-fill" style="align-self: flex-start; width: 120px; height: 30px;"></div></div>
  <div class="row" id="row-grow"><div id="grow" style="flex: 1 1 0; height: 40px;"></div><div style="flex: none; width: 50px; height: 40px;"></div></div>
  <div class="row" id="row-full"><div id="full" style="flex: none; width: 150px; height: 40px;"></div><div style="flex: none; width: 50px; height: 40px;"></div></div>
  <div class="row" id="row-gap"><div id="gapped" style="flex: none; width: 100px; height: 40px;"></div><div style="flex: none; width: 50px; height: 40px;"></div></div>
  <div id="block" style="width: 200px; height: 100px;"><div id="block-child" style="width: 200px; height: 30px;"></div></div>
  <div id="root-wrap" style="display: flex; flex-direction: column; align-items: flex-start; width: 200px; height: 100px;"><div id="root-variant" style="width: 120px; height: 40px;"></div></div>
  <p id="centred" style="width: 120px; height: 40px; margin: 0; text-align: center; font-family: Inter, sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; color: #333333;">Some words that wrap onto more than one line of this text</p>
</body>
</html>`;

/** A box with every default, then the values given. */
function box(width: number, height: number, extra: Partial<FigmaNode> = {}): FigmaNode {
  return {
    x: 0,
    y: 0,
    width,
    height,
    opacity: 1,
    fill: null,
    stroke: null,
    strokeWeight: 0,
    radius: 0,
    rings: [],
    shadows: [],
    label: null,
    ...extra,
  };
}

const tinted: FigmaNode = box(200, 120, {
  opacity: 0.5,
  fill: "#a800b780",
  stroke: "#111111",
  strokeWeight: [1, 2, 3, 4],
  strokeAlign: "inside",
  radius: [4, 8, 12, 16],
  rings: [["#00ff00", 3]],
  shadows: [
    { x: 0, y: 4, blur: 6, spread: -1, color: "#0000004d", inset: false },
    { x: 0, y: 0, blur: 0, spread: 2, color: "#ff0000", inset: true },
  ],
  sizing: ["fixed", "fixed"],
  minWidth: 100,
  maxWidth: 300,
  minHeight: 40,
});

const dashed: FigmaNode = box(120, 40, {
  stroke: "#222222",
  strokeWeight: 2,
  strokeAlign: "inside",
  dashed: true,
});

const outlined: FigmaNode = box(120, 40, {
  stroke: "#0000ff",
  strokeWeight: 2,
  strokeAlign: "outside",
});

const labelled: FigmaNode = box(160, 36, {
  fill: "#a800b7",
  radius: 6,
  label: {
    x: 16,
    y: 8,
    height: 20,
    color: "#ffffff",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 20,
    letterSpacing: 0.5,
    textCase: "uppercase",
    textDecoration: "underline",
    textAlign: "left",
  },
});

const smallCaps: FigmaNode = box(160, 36, {
  fill: "#a800b7",
  radius: 6,
  label: {
    x: 16,
    y: 8,
    height: 20,
    color: "#ffffff",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 20,
    letterSpacing: 0,
    textCase: "small-caps",
    textDecoration: "none",
    textAlign: "left",
  },
});

const placeholder: FigmaNode = box(120, 40, {
  fill: "#ffffff",
  radius: 8,
  shadows: [{ x: 0, y: 2, blur: 4, spread: 0, color: "#00000033", inset: false }],
});

const flex: FigmaNode = box(200, 60, {
  layout: {
    direction: "row",
    gap: 8,
    padding: [4, 8, 4, 8],
    justify: "space-between",
    align: "center",
    wrap: true,
    rowGap: 6,
  },
});

const centred: FigmaText = {
  x: 0,
  y: 0,
  width: 120,
  height: 40,
  id: "1:9",
  type: "TEXT",
  parent: "1:1",
  color: "#333333",
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 20,
  fontFamily: "Inter",
  letterSpacing: 0,
  textCase: "none",
  textDecoration: "none",
  textAlign: "center",
  wraps: true,
  opacity: 1,
};

const fillChild = box(200, 30, { sizing: ["fill", "hug"] });
const shortFill = box(120, 30, { sizing: ["fill", "hug"] });
const grow = box(150, 40, { sizing: ["fill", "hug"] });
const full = box(150, 40, { sizing: ["fill", "hug"] });
const gapped = box(100, 40, { sizing: ["fill", "hug"] });
const blockChild = box(200, 30, { sizing: ["fill", "hug"] });
const rootVariant = box(120, 40, { sizing: ["fill", "fill"] });

/** The defaults a format-2 export leaves out, as export-node writes them. */
const defaults: Json = {
  fill: null,
  stroke: null,
  strokeWeight: 0,
  radius: 0,
  rings: [],
  label: null,
  opacity: 1,
  shadows: [],
  letterSpacing: 0,
  textCase: "none",
  textDecoration: "none",
};

/** A node in format 2: each field at its default left out, a label's typography too, strokeAlign where it is inside a stroke. */
function asFormat2(node: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(node)) {
    if (key in defaults && JSON.stringify(defaults[key]) === JSON.stringify(value)) continue;
    if (key === "strokeAlign" && value === "inside" && node.stroke !== null) continue;
    if (key === "label" && value !== null) out[key] = asFormat2(value as Json);
    else out[key] = value;
  }
  return out;
}

/** The format-2 node a loader returns for one key. */
function restored<T>(key: string, node: Json): T {
  return nodesOf<T>({ format: 2, variants: { [key]: asFormat2(node) } })[key]!;
}

/** The hash figma-flow's export-node writes: the same as loadFigmaExport's. */
function hashOf(body: string) {
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

const dir = mkdtempSync(join(tmpdir(), "figma-helper-"));

/** Writes an export as export-node does: the header fields, the variants one per line, and the hash last. */
function exportFile(name: string, header: Json, variants: [key: string, node: Json][]) {
  const fields = Object.entries(header).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`,
  );
  const lines = variants.map(([key, node]) => `    ${JSON.stringify(key)}: ${JSON.stringify(node)}`);
  const body = `{\n${fields.join("")}  "variants": {\n${lines.join(",\n")}\n  },\n`;
  const file = join(dir, name);
  writeFileSync(file, `${body}  "hash": "${hashOf(body)}"\n}\n`);
  return pathToFileURL(file);
}

test.describe("the loader", () => {
  test("an older export is returned as it is, with its absent fields still absent", () => {
    const old: Json = { x: 0, y: 0, width: 10, height: 10, fill: "#000000", stroke: null, strokeWeight: 0 };
    const nodes = nodesOf<FigmaNode>({ variants: { a: old } });
    expect(nodes.a).toBe(old);
    expect("opacity" in nodes.a!).toBe(false);
    expect("rings" in nodes.a!).toBe(false);
  });

  test("a format-2 box gets its defaults back", () => {
    const node = restored<FigmaNode>("a", {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "#000000",
      strokeWeight: 0,
    });
    expect(node).toMatchObject({ opacity: 1, stroke: null, radius: 0, rings: [], shadows: [], label: null });
    expect("strokeAlign" in node).toBe(false);
  });

  test("a format-2 node round-trips to the node it was written from", () => {
    for (const node of [tinted, dashed, outlined, labelled, smallCaps, placeholder, flex, rootVariant]) {
      expect(restored<FigmaNode>("a", node)).toEqual(node);
    }
  });

  test("a format-2 label that is null gets no label defaults", () => {
    const node = restored<FigmaNode>("a", {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "#000000",
      label: null,
    });
    expect(node.label).toBeNull();
    expect("letterSpacing" in node).toBe(false);
  });

  test("a format-2 TEXT entry on a page gets its typography and opacity", () => {
    const text = nodesOf<FigmaText>({
      format: 2,
      variants: {
        "1:2": {
          type: "TEXT",
          id: "1:2",
          parent: "1:1",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          color: "#000000",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 20,
          fontFamily: "Inter",
          wraps: false,
        },
      },
    })["1:2"]!;
    expect(text).toMatchObject({ letterSpacing: 0, textCase: "none", textDecoration: "none", opacity: 1 });
    expect("fill" in text).toBe(false);
    expect("label" in text).toBe(false);
  });

  test("strokeAlign is inside only where there is a stroke", () => {
    const bare = restored<FigmaNode>("a", { x: 0, y: 0, width: 10, height: 10, stroke: null });
    expect("strokeAlign" in bare).toBe(false);
    const stroked = restored<FigmaNode>("a", {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      stroke: "#000000",
      strokeWeight: 1,
    });
    expect(stroked.strokeAlign).toBe("inside");
  });

  test("a format this helper doesn't read is refused", () => {
    expect(() => nodesOf({ format: 3, variants: {} })).toThrow(/format 3/);
  });

  test("loadFigmaNodes fills a format-2 file's defaults in, and an older file is untouched", () => {
    const fresh = loadFigmaNodes(
      exportFile("format-2.json", { file: "test", node: "1:1", format: 2 }, [
        ["variant=default", asFormat2(box(10, 10))],
      ]),
    );
    expect(fresh["variant=default"]!.opacity).toBe(1);
    const older = loadFigmaNodes(
      exportFile("older.json", { file: "test", node: "1:1" }, [
        ["variant=default", { x: 0, y: 0, width: 10, height: 10 }],
      ]),
    );
    expect("opacity" in older["variant=default"]!).toBe(false);
  });

  test("loadFigmaPage fills a page's TEXT and frame defaults in", () => {
    const url = exportFile("page.json", { file: "test", node: "1:1", format: 2 }, [
      ["1:1", asFormat2({ ...box(200, 100), type: "FRAME", id: "1:1", parent: null })],
      [
        "1:2",
        {
          type: "TEXT",
          id: "1:2",
          parent: "1:1",
          x: 10,
          y: 10,
          width: 100,
          height: 20,
          color: "#000000",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 20,
          fontFamily: "Inter",
          wraps: false,
        },
      ],
    ]);
    const page = loadFigmaPage(url);
    expect(page["1:2"]).toMatchObject({
      letterSpacing: 0,
      textCase: "none",
      textDecoration: "none",
      opacity: 1,
    });
    expect(page["1:1"]).toMatchObject({ fill: null, label: null, opacity: 1 });
  });

  test("an export that repeats a key is refused", () => {
    const url = exportFile("repeat.json", { file: "test", node: "1:1" }, [
      ["a", { x: 0, y: 0, width: 10, height: 10 }],
      ["a", { x: 0, y: 0, width: 20, height: 20 }],
    ]);
    expect(() => loadFigmaNodes(url)).toThrow(/repeats "?a"?/);
  });
});

test.describe("the browser helper", () => {
  const open = (page: Page) => page.setContent(PAGE);

  const fixtures: [id: string, node: FigmaNode][] = [
    ["tinted", tinted],
    ["dashed", dashed],
    ["outlined", outlined],
    ["labelled", labelled],
    ["small-caps", smallCaps],
    ["placeholder", placeholder],
    ["flex", flex],
  ];
  for (const [id, node] of fixtures) {
    for (const shape of ["old", "format 2"] as const) {
      test(`#${id} matches its Figma node, ${shape} shape`, async ({ page }) => {
        await open(page);
        let figma = node;
        if (shape === "format 2") figma = restored<FigmaNode>(id, node);
        await expectToMatchFigma(page.locator(`#${id}`), figma);
      });
    }
  }

  for (const shape of ["old", "format 2"] as const) {
    test(`#centred text matches its Figma node, ${shape} shape`, async ({ page }) => {
      await open(page);
      let figma = centred;
      if (shape === "format 2") figma = restored<FigmaText>("centred", centred);
      await expectTextToMatchFigma(page.locator("#centred"), figma);
    });
  }

  // Each field alone, changed on the Figma side: the element is drawn the same, so the field must fail.
  const label =
    (change: Partial<NonNullable<FigmaNode["label"]>>): Change =>
    (node) => ({ ...node, label: { ...node.label!, ...change } });
  const layout =
    (change: Partial<NonNullable<FigmaNode["layout"]>>): Change =>
    (node) => ({ ...node, layout: { ...node.layout!, ...change } });
  const perturbations: [id: string, field: string, base: FigmaNode, change: Change][] = [
    ["tinted", "opacity", tinted, (node) => ({ ...node, opacity: 0.6 })],
    ["tinted", "fill", tinted, (node) => ({ ...node, fill: "#ffffff" })],
    ["tinted", "stroke", tinted, (node) => ({ ...node, stroke: "#222222" })],
    ["tinted", "strokeWeight", tinted, (node) => ({ ...node, strokeWeight: [1, 2, 3, 5] })],
    ["tinted", "strokeAlign", tinted, (node) => ({ ...node, strokeAlign: "outside" })],
    ["tinted", "dashed", tinted, (node) => ({ ...node, dashed: true })],
    ["tinted", "radius", tinted, (node) => ({ ...node, radius: [4, 8, 12, 15] })],
    ["tinted", "rings colour", tinted, (node) => ({ ...node, rings: [["#ff0000", 3]] })],
    ["tinted", "rings spread", tinted, (node) => ({ ...node, rings: [["#00ff00", 4]] })],
    [
      "tinted",
      "shadow blur",
      tinted,
      (node) => ({ ...node, shadows: [{ ...node.shadows![0]!, blur: 8 }, node.shadows![1]!] }),
    ],
    [
      "tinted",
      "shadow colour",
      tinted,
      (node) => ({ ...node, shadows: [{ ...node.shadows![0]!, color: "#00000080" }, node.shadows![1]!] }),
    ],
    [
      "tinted",
      "inset",
      tinted,
      (node) => ({ ...node, shadows: [node.shadows![0]!, { ...node.shadows![1]!, inset: false }] }),
    ],
    ["tinted", "minWidth", tinted, (node) => ({ ...node, minWidth: 120 })],
    ["tinted", "maxWidth", tinted, (node) => ({ ...node, maxWidth: 280 })],
    ["tinted", "minHeight", tinted, (node) => ({ ...node, minHeight: 50 })],
    ["tinted", "width", tinted, (node) => ({ ...node, width: 210 })],
    ["tinted", "height", tinted, (node) => ({ ...node, height: 130 })],
    [
      "dashed",
      "a solid stroke",
      dashed,
      (node) => {
        const copy = { ...node };
        delete copy.dashed;
        return copy;
      },
    ],
    ["dashed", "strokeWeight", dashed, (node) => ({ ...node, strokeWeight: 3 })],
    ["dashed", "stroke", dashed, (node) => ({ ...node, stroke: "#ff0000" })],
    ["outlined", "strokeWeight", outlined, (node) => ({ ...node, strokeWeight: 3 })],
    ["outlined", "strokeAlign", outlined, (node) => ({ ...node, strokeAlign: "inside" })],
    ["outlined", "stroke", outlined, (node) => ({ ...node, stroke: "#ff0000" })],
    ["outlined", "dashed", outlined, (node) => ({ ...node, dashed: true })],
    ["labelled", "label x", labelled, label({ x: 20 })],
    ["labelled", "label y", labelled, label({ y: 10 })],
    ["labelled", "label height", labelled, label({ height: 24 })],
    ["labelled", "label colour", labelled, label({ color: "#000000" })],
    ["labelled", "label fontSize", labelled, label({ fontSize: 16 })],
    ["labelled", "label fontWeight", labelled, label({ fontWeight: 400 })],
    ["labelled", "label lineHeight", labelled, label({ lineHeight: 24 })],
    ["labelled", "label fontFamily", labelled, label({ fontFamily: "Arial" })],
    ["labelled", "label letterSpacing", labelled, label({ letterSpacing: 1 })],
    ["labelled", "label textCase", labelled, label({ textCase: "none" })],
    ["labelled", "label textDecoration", labelled, label({ textDecoration: "none" })],
    ["labelled", "label textAlign", labelled, label({ textAlign: "center" })],
    ["small-caps", "label textCase", smallCaps, label({ textCase: "uppercase" })],
    [
      "placeholder",
      "shadow blur",
      placeholder,
      (node) => ({ ...node, shadows: [{ ...node.shadows![0]!, blur: 6 }] }),
    ],
    ["flex", "justify", flex, layout({ justify: "start" })],
    ["flex", "align", flex, layout({ align: "start" })],
    ["flex", "gap", flex, layout({ gap: 4 })],
    ["flex", "rowGap", flex, layout({ rowGap: 10 })],
    ["flex", "padding", flex, layout({ padding: [0, 8, 4, 8] })],
    ["flex", "direction", flex, layout({ direction: "column" })],
  ];
  for (const [id, field, base, change] of perturbations) {
    test(`#${id}: a different ${field} fails`, async ({ page }) => {
      test.fail();
      await open(page);
      await expectToMatchFigma(page.locator(`#${id}`), change(base));
    });
  }

  test("#flex: a wrapping layout drawn without wrap fails", async ({ page }) => {
    test.fail();
    await open(page);
    await page.locator("#flex").evaluate((el) => {
      el.style.flexWrap = "nowrap";
    });
    await expectToMatchFigma(page.locator("#flex"), flex);
  });

  const textPerturbations: [field: string, change: (node: FigmaText) => FigmaText][] = [
    ["textAlign", (node) => ({ ...node, textAlign: "left" })],
    ["fontSize", (node) => ({ ...node, fontSize: 16 })],
    ["fontWeight", (node) => ({ ...node, fontWeight: 600 })],
    ["lineHeight", (node) => ({ ...node, lineHeight: 24 })],
    ["letterSpacing", (node) => ({ ...node, letterSpacing: 1 })],
    ["textCase", (node) => ({ ...node, textCase: "uppercase" })],
    ["textDecoration", (node) => ({ ...node, textDecoration: "underline" })],
    ["colour", (node) => ({ ...node, color: "#000000" })],
    ["opacity", (node) => ({ ...node, opacity: 0.5 })],
    ["fontFamily", (node) => ({ ...node, fontFamily: "Arial" })],
    ["height", (node) => ({ ...node, height: 60 })],
    ["width", (node) => ({ ...node, width: 100 })],
  ];
  for (const [field, change] of textPerturbations) {
    test(`#centred text: a different ${field} fails`, async ({ page }) => {
      test.fail();
      await open(page);
      await expectTextToMatchFigma(page.locator("#centred"), change(centred));
    });
  }

  test("a transparent shadow layer beside a real one is ignored", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#placeholder"), placeholder);
  });

  test("small-caps passes for textCase small-caps, and letter-spacing normal for 0", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#small-caps"), smallCaps);
  });

  test("a format-2 node with opacity omitted fails against an element at opacity 0.5", async ({ page }) => {
    test.fail();
    await open(page);
    await expectToMatchFigma(
      page.locator("#tinted"),
      restored<FigmaNode>("tinted", { ...tinted, opacity: 1 }),
    );
  });

  test("an older stroke with no strokeAlign or dashed isn't checked for style", async ({ page }) => {
    await open(page);
    const older = { ...dashed };
    delete older.dashed;
    delete older.strokeAlign;
    await expectToMatchFigma(page.locator("#dashed"), older);
  });

  test("a format-2 stroke that isn't dashed is expected solid", async ({ page }) => {
    test.fail();
    await open(page);
    const solid = { ...dashed };
    delete solid.dashed;
    await expectToMatchFigma(page.locator("#dashed"), restored<FigmaNode>("dashed", solid));
  });

  test("a fill child that spans its parent's cross axis passes", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#fill-child"), fillChild);
  });

  test("a fill child shorter than its parent's content on the cross axis fails", async ({ page }) => {
    test.fail();
    await open(page);
    await expectToMatchFigma(page.locator("#short-fill"), shortFill);
  });

  test("the same fill child passes with sizing: false", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#short-fill"), shortFill, { sizing: false });
  });

  test("a fill child that grows along its flex parent passes", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#grow"), grow);
  });

  test("a fill child that leaves no free room on its flex parent passes", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#full"), full);
  });

  test("a fill child with free room and no grow fails", async ({ page }) => {
    test.fail();
    await open(page);
    await expectToMatchFigma(page.locator("#gapped"), gapped);
  });

  test("a fill child of a display:block parent is noted, not failed", async ({ page }) => {
    await open(page);
    await expectToMatchFigma(page.locator("#block-child"), blockChild);
    expect(test.info().annotations.map((annotation) => annotation.type)).toContain("figma: not measured");
  });

  test("a root variant marked fill is not fill-checked", async ({ page }) => {
    await open(page);
    const root = restored<FigmaNode>("variant=default", rootVariant);
    await expectToMatchFigma(page.locator("#root-variant"), root);
  });

  test("the same node, not a root, is fill-checked and fails", async ({ page }) => {
    test.fail();
    await open(page);
    await expectToMatchFigma(page.locator("#root-variant"), { ...rootVariant });
  });
});
