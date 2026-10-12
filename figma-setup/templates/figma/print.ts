// Prints one of the scripts in this folder as the plain JavaScript that the Figma MCP's
// `use_figma` tool runs: types stripped, and a final `return` calling its default export.
//
//   node figma/print.ts export-tokens
//   node figma/print.ts export-node 1:91
//
// The scripts run inside Figma, not in Node, so they can't be imported and called here.
//
// To check that a saved export is exactly what Figma returned, without reading it all back:
//
//   node figma/print.ts export-tokens --hash     the script returns only { length, hash }
//   node figma/print.ts hash figma/tokens.json   the same two numbers for the saved file
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// djb2, the same hash export-node writes into its own last line.
const HASH = "let hash = 5381;\nfor (let i = 0; i < out.length; i++) hash = ((hash * 33) ^ out.charCodeAt(i)) >>> 0;";

const [name, ...rest] = process.argv.slice(2);
if (!name) throw new Error("usage: node figma/print.ts <script> [arguments] [--hash] | hash <file>");

if (name === "hash") {
  const out = readFileSync(rest[0]!, "utf8");
  let hash = 5381;
  for (let i = 0; i < out.length; i++) hash = ((hash * 33) ^ out.charCodeAt(i)) >>> 0;
  console.log(JSON.stringify({ length: out.length, hash: hash.toString(16) }));
} else {
  const isHashOnly = rest.includes("--hash");
  const args = rest.filter((arg) => arg !== "--hash");
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), "utf8");
  const entry = /^export default (async function (\w+))/m.exec(source);
  if (!entry) throw new Error(`${name}.ts needs an "export default async function name"`);

  const body = stripTypeScriptTypes(source).replace(entry[0], entry[1]!);
  const call = `await ${entry[2]}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`;
  console.log(
    isHashOnly
      ? `${body}\nconst out = ${call};\n${HASH}\nreturn { length: out.length, hash: hash.toString(16) };`
      : `${body}\nreturn ${call};`,
  );
}
