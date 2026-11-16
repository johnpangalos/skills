// Runs export-tokens against a fake Figma file: `node --test "figma-flow/scripts/*.test.ts"`, from the repo root.
// The script runs inside Figma, so here it gets a stand-in `figma` global with just what it reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

type Collection = { id: string; name: string; remote: boolean; modes: { modeId: string; name?: string }[] };
type Variable = { id: string; name: string; variableCollectionId: string; resolvedType: string; valuesByMode: Record<string, unknown>; codeSyntax: { WEB?: string } };
type File = {
  collections?: Collection[];
  variables?: Variable[];
  textStyles?: Record<string, unknown>[];
  effectStyles?: Record<string, unknown>[];
  // Variables the file doesn't define but its nodes are bound to: a library's, imported by use.
  remote?: { collection: Collection; variable: Variable }[];
};

const source = readFileSync(new URL("./export-tokens.ts", import.meta.url), "utf8");
const body = stripTypeScriptTypes(source).replace(/^export default /m, "");
const run = (file: File): Promise<string> => {
  const remote = file.remote ?? [];
  const nodes = remote.map(({ variable }) => ({ boundVariables: { fills: [{ type: "VARIABLE_ALIAS", id: variable.id }] } }));
  const figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => file.collections ?? [],
      getLocalVariablesAsync: async () => file.variables ?? [],
      getVariableByIdAsync: async (id: string) => [...(file.variables ?? []), ...remote.map((r) => r.variable)].find((v) => v.id === id) ?? null,
      getVariableCollectionByIdAsync: async (id: string) =>
        [...(file.collections ?? []), ...remote.map((r) => r.collection)].find((c) => c.id === id) ?? null,
    },
    getLocalTextStylesAsync: async () => file.textStyles ?? [],
    getLocalEffectStylesAsync: async () => file.effectStyles ?? [],
    currentPage: { findAll: (keep: (node: object) => boolean) => nodes.filter(keep) },
  };
  return new Function("figma", `${body}\nreturn exportTokens();`)(figma);
};

const colors: Collection = { id: "c:1", name: "Colors", remote: false, modes: [{ modeId: "m:1" }] };
const gray: Variable = {
  id: "v:1", name: "gray/900", variableCollectionId: "c:1", resolvedType: "COLOR",
  valuesByMode: { "m:1": { r: 16 / 255, g: 24 / 255, b: 40 / 255, a: 1 } }, codeSyntax: { WEB: "var(--color-gray-900)" },
};

test("a file that defines its variables gets a snapshot of them", async () => {
  const out = await run({ collections: [colors], variables: [gray] });
  assert.deepEqual(JSON.parse(out), {
    Colors: { "gray/900": { value: "#101828", web: "var(--color-gray-900)" } },
    textStyles: {},
    effectStyles: {},
  });
});

test("a product file built from a library throws, naming the library's collections, instead of an empty snapshot", async () => {
  const spacing: Collection = { id: "c:9", name: "Spacing", remote: true, modes: [{ modeId: "m:9" }] };
  const space: Variable = { ...gray, id: "v:9", name: "spacing/6", variableCollectionId: "c:9", resolvedType: "FLOAT", valuesByMode: { "m:9": 24 } };
  await assert.rejects(run({ remote: [{ collection: spacing, variable: space }] }), {
    message: "This file has no variables or styles of its own; its nodes use a library's (Spacing). Run export-tokens on the library's file.",
  });
});

test("an empty file throws too", async () => {
  await assert.rejects(run({}), { message: "This file has no variables or styles of its own. Run export-tokens on the file that defines them." });
});

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });
const variable = (id: string, name: string, collection: string, valuesByMode: Record<string, unknown>, codeSyntax: { WEB?: string } = {}, resolvedType = "FLOAT"): Variable =>
  ({ id, name, variableCollectionId: collection, resolvedType, valuesByMode, codeSyntax });
const textStyle = (name: string, extra: Record<string, unknown> = {}) => ({
  name, fontName: { family: "Inter", style: "Regular" }, fontSize: 14, lineHeight: { unit: "PIXELS", value: 20 },
  letterSpacing: { unit: "PERCENT", value: 0 }, textCase: "ORIGINAL", textDecoration: "NONE", boundVariables: {}, ...extra,
});
const effectStyle = (name: string, effects: Record<string, unknown>[]) => ({ name, effects });

test("B1: a text style records its font's weight, letter spacing in px, its case and its decoration", async () => {
  const font = (style: string) => ({ fontName: { family: "Inter", style } });
  const out = JSON.parse(
    await run({
      textStyles: [
        textStyle("text-sm/semibold", { ...font("Semi Bold"), lineHeight: { unit: "PERCENT", value: 150 }, letterSpacing: { unit: "PERCENT", value: 2 }, textCase: "UPPER", textDecoration: "UNDERLINE" }),
        textStyle("text-sm/normal", { ...font("Regular"), fontSize: 16, lineHeight: { unit: "AUTO" }, letterSpacing: { unit: "PIXELS", value: 0.5 } }),
        textStyle("Display/Quirky", { ...font("Quirky"), fontSize: 40, textCase: "SMALL_CAPS", textDecoration: "STRIKETHROUGH" }),
      ],
    }),
  );
  assert.deepEqual(out.textStyles, {
    "text-sm/semibold": { family: "Inter", style: "Semi Bold", size: 14, lineHeight: 21, weight: 600, letterSpacing: 0.28, textCase: "uppercase", textDecoration: "underline" },
    "text-sm/normal": { family: "Inter", style: "Regular", size: 16, lineHeight: "AUTO", weight: 400, letterSpacing: 0.5, textCase: "none", textDecoration: "none" },
    "Display/Quirky": { family: "Inter", style: "Quirky", size: 40, lineHeight: 20, weight: null, letterSpacing: 0, textCase: "small-caps", textDecoration: "line-through" },
  });
});

test("B1: a bound fontWeight variable gives the weight, over the font's", async () => {
  const typography: Collection = { id: "c:w", name: "Typography", remote: false, modes: [{ modeId: "m:w" }] };
  const bold = variable("v:w", "weight/bold", "c:w", { "m:w": 700 });
  const out = JSON.parse(
    await run({ collections: [typography], variables: [bold], textStyles: [textStyle("text-sm/medium", { boundVariables: { fontWeight: alias("v:w") } })] }),
  );
  assert.equal(out.textStyles["text-sm/medium"].weight, 700);
});

test("B2: an effect style lists its shadows and blurs, and leaves hidden effects out", async () => {
  const out = JSON.parse(
    await run({
      effectStyles: [
        effectStyle("shadow-md", [
          { type: "DROP_SHADOW", visible: true, radius: 3, spread: -1, offset: { x: 0, y: 2 }, color: { r: 0, g: 0, b: 0, a: 0.1 } },
          { type: "DROP_SHADOW", visible: false, radius: 9, spread: 0, offset: { x: 0, y: 9 }, color: { r: 0, g: 0, b: 0, a: 1 } },
          { type: "LAYER_BLUR", visible: true, radius: 8 },
          { type: "BACKGROUND_BLUR", visible: false, radius: 16 },
          { type: "BACKGROUND_BLUR", visible: true, radius: 4 },
        ]),
      ],
    }),
  );
  assert.deepEqual(out.effectStyles["shadow-md"], [
    { type: "DROP_SHADOW", x: 0, y: 2, blur: 3, spread: -1, color: "#000000", alpha: 0.1 },
    { type: "LAYER_BLUR", blur: 8 },
    { type: "BACKGROUND_BLUR", blur: 4 },
  ]);
});

test("B3: an alias is resolved to its value, and names the variable it points at", async () => {
  const brand = variable("v:brand", "brand/primary", "c:1", { "m:1": alias("v:1") }, { WEB: "var(--color-brand)" }, "COLOR");
  const chained = variable("v:chain", "brand/chained", "c:1", { "m:1": alias("v:brand") }, {}, "COLOR");
  const out = JSON.parse(await run({ collections: [colors], variables: [gray, brand, chained] }));
  assert.deepEqual(out.Colors["brand/primary"], { value: "#101828", web: "var(--color-brand)", alias: "gray/900" });
  assert.deepEqual(out.Colors["brand/chained"], { value: "#101828", web: null, alias: "brand/primary" });
});

test("B3: an alias into another collection takes that collection's first mode", async () => {
  const spacing: Collection = { id: "c:s", name: "Spacing", remote: false, modes: [{ modeId: "m:s1", name: "Default" }, { modeId: "m:s2", name: "Large" }] };
  const layout: Collection = { id: "c:l", name: "Layout", remote: false, modes: [{ modeId: "m:l" }] };
  const six = variable("v:six", "spacing/6", "c:s", { "m:s1": 24, "m:s2": 32 });
  const gap = variable("v:gap", "gap/card", "c:l", { "m:l": alias("v:six") });
  const out = JSON.parse(await run({ collections: [spacing, layout], variables: [six, gap] }));
  assert.deepEqual(out.Layout["gap/card"], { value: 24, web: null, alias: "spacing/6" });
});

test("B3 hostile: a missing target gives a null value, and a cycle gives null without hanging", async () => {
  const orphan = variable("v:orphan", "orphan", "c:1", { "m:1": alias("v:gone") }, {}, "COLOR");
  const loopA = variable("v:a", "loop/a", "c:1", { "m:1": alias("v:b") }, {}, "COLOR");
  const loopB = variable("v:b", "loop/b", "c:1", { "m:1": alias("v:a") }, {}, "COLOR");
  const self = variable("v:self", "loop/self", "c:1", { "m:1": alias("v:self") }, {}, "COLOR");
  const out = JSON.parse(await run({ collections: [colors], variables: [orphan, loopA, loopB, self] }));
  assert.deepEqual(out.Colors["orphan"], { value: null, web: null });
  assert.deepEqual(out.Colors["loop/a"], { value: null, web: null, alias: "loop/b" });
  assert.deepEqual(out.Colors["loop/b"], { value: null, web: null, alias: "loop/a" });
  assert.deepEqual(out.Colors["loop/self"], { value: null, web: null, alias: "loop/self" });
});

test("B4: a collection with two or more modes gives each variable its value in every mode", async () => {
  const theme: Collection = { id: "c:t", name: "Theme", remote: false, modes: [{ modeId: "m:light", name: "Light" }, { modeId: "m:dark", name: "Dark" }] };
  const surface = variable("v:surface", "surface", "c:t", { "m:light": { r: 1, g: 1, b: 1, a: 1 }, "m:dark": { r: 16 / 255, g: 24 / 255, b: 40 / 255, a: 1 } }, { WEB: "var(--color-surface)" }, "COLOR");
  const ink = variable("v:ink", "ink", "c:t", { "m:light": alias("v:surface"), "m:dark": { r: 0, g: 0, b: 0, a: 1 } }, {}, "COLOR");
  const out = JSON.parse(await run({ collections: [theme], variables: [surface, ink] }));
  assert.deepEqual(out.Theme.surface, { value: "#ffffff", web: "var(--color-surface)", modes: { Light: "#ffffff", Dark: "#101828" } });
  assert.deepEqual(out.Theme.ink, { value: "#ffffff", web: null, alias: "surface", modes: { Light: "#ffffff", Dark: "#000000" } });
});

test("B4: a one-mode collection's output is unchanged, byte for byte", async () => {
  assert.equal(
    await run({ collections: [colors], variables: [gray] }),
    '{\n  "Colors": {\n    "gray/900": {"value":"#101828","web":"var(--color-gray-900)"}\n  },\n  "textStyles": {\n\n  },\n  "effectStyles": {\n\n  }\n}\n',
  );
});

test("B5: a weight is read from the font's style whatever its case, spacing or italic suffix, and anything else is null", async () => {
  const styles = ["Semi Bold Italic", "extra light", "BOLD", "Italic", "constructor", "Thin", "Unknown"];
  const out = JSON.parse(await run({ textStyles: styles.map((style, i) => textStyle(`s/${i}`, { fontName: { family: "Inter", style } })) }));
  assert.deepEqual(
    styles.map((_, i) => out.textStyles[`s/${i}`].weight),
    [600, 200, 700, null, null, 100, null],
  );
});

test("B5 hostile: a bound fontWeight variable that isn't in the file gives a null weight, not a throw", async () => {
  const out = JSON.parse(await run({ collections: [colors], variables: [gray], textStyles: [textStyle("text-sm/bold", { boundVariables: { fontWeight: alias("v:gone") } })] }));
  assert.equal(out.textStyles["text-sm/bold"].weight, null);
});
