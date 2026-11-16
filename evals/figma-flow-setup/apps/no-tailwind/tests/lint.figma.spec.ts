import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Template: every export was linted in Figma first (figma-flow's lint-node, on the same ids), and
// the lint found nothing that isn't accepted on purpose in lint-ignore.json, each with its reason.
// A finding is fixed in Figma, never in code. Point the path at the exports folder.
type Finding = { variant: string; layer: string; node: string; rule: string; field: string; value: unknown };
type Ignore = { node: string; rule: string; layer: string; field: string; reason: string };
type Lint = { file: string; node: string; findings: Finding[] };

const folder = new URL("../figma/", import.meta.url);

// Reads a file whose last line is a hash of the rest (an export or a lint), and checks the hash.
function load(file: string): Record<string, unknown> {
  const text = readFileSync(new URL(file, folder), "utf8");
  const body = text.slice(0, text.lastIndexOf('  "hash"'));
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  const parsed = JSON.parse(text);
  if (hash.toString(16) !== parsed.hash) throw new Error(`${file} doesn't match its hash: run it in Figma again`);
  return parsed;
}

const files = readdirSync(folder);
const ignores: Ignore[] = files.includes("lint-ignore.json")
  ? JSON.parse(readFileSync(new URL("lint-ignore.json", folder), "utf8"))
  : [];
const matches = (ignore: Ignore, nodes: string, finding: Finding) =>
  ignore.node === nodes && ignore.rule === finding.rule && ignore.layer === finding.layer && ignore.field === finding.field;

// The export-node files: <name>.json, not the lint or ignore files or the token snapshot.
const exports = files.filter(
  (file) => /^[a-z0-9-]+\.json$/.test(file) && !/-lint\.json$|^lint-ignore\.json$|^tokens\.json$/.test(file),
);

for (const file of exports) {
  const name = file.replace(/\.json$/, "");

  test(`${name} passes the Figma lint`, () => {
    const nodes = String(load(file).node);
    expect(files, `${name}-lint.json: lint the nodes with figma-flow's lint-node`).toContain(`${name}-lint.json`);
    const lint = load(`${name}-lint.json`) as Lint;
    expect(lint.node, "the lint is of the nodes that were exported").toBe(nodes);

    const open = lint.findings.filter((finding) => !ignores.some((ignore) => matches(ignore, nodes, finding)));
    const report = open.map(
      (f) =>
        `${f.rule} ${f.field} = ${JSON.stringify(f.value)} on "${f.layer || "(variant)"}" in ${f.variant}: ` +
        `https://www.figma.com/design/${lint.file}?node-id=${f.node.replace(":", "-")}`,
    );
    expect(report, "fix these in Figma and lint again, or accept one in lint-ignore.json with a reason").toEqual([]);
  });
}

test("every accepted lint finding still occurs", () => {
  const lints = files.filter((file) => file.endsWith("-lint.json")).map((file) => load(file) as Lint);
  const stale = ignores.filter(
    (ignore) => !lints.some((lint) => lint.findings.some((finding) => matches(ignore, lint.node, finding))),
  );
  expect(stale, "remove these from lint-ignore.json: Figma no longer has them").toEqual([]);
});
