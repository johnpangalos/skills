// Runs export-tokens against a fake Figma file: `node --test "figma-flow/scripts/*.test.ts"`, from the repo root.
// The script runs inside Figma, so here it gets a stand-in `figma` global with just what it reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

type Collection = { id: string; name: string; remote: boolean; modes: { modeId: string }[] };
type Variable = { id: string; name: string; variableCollectionId: string; resolvedType: string; valuesByMode: Record<string, unknown>; codeSyntax: { WEB?: string } };
type File = {
  collections?: Collection[];
  variables?: Variable[];
  textStyles?: unknown[];
  effectStyles?: unknown[];
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
      getVariableByIdAsync: async (id: string) => remote.find(({ variable }) => variable.id === id)?.variable ?? null,
      getVariableCollectionByIdAsync: async (id: string) => remote.find(({ collection }) => collection.id === id)?.collection ?? null,
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
    message: "This file has no variables or styles of its own; its nodes use a library's (Spacing). Run export-tokens on the file that defines them, the library's.",
  });
});

test("an empty file throws too", async () => {
  await assert.rejects(run({}), /has no variables or styles of its own\. Run export-tokens/);
});
