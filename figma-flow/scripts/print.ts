// Prints one of the scripts in this folder as the plain JavaScript that the Figma MCP's
// `use_figma` tool runs: types stripped, and a final `return` calling its default export.
// Run it by its full path from the project; it reads nothing from the working directory but
// the file given to `hash`.
//
//   node scripts/print.ts export-tokens
//   node scripts/print.ts export-node 1:91
//
// The scripts run inside Figma, not in Node, so they can't be imported and called here.
//
// To check that a saved export is exactly what Figma returned, without reading it all back:
//
//   node scripts/print.ts export-tokens --hash     the script returns only { length, hash }
//   node scripts/print.ts hash <saved file>      the same two numbers for the saved file
//
// That pair is for the token snapshot, which has no hash of its own. An export or a lint ends in a
// hash of everything above its last line; to check one saved by hand, without Figma:
//
//   node scripts/print.ts check <saved file>     exits 1 unless the file matches its own hash
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// djb2, the same hash export-node writes into its own last line.
const HASH = "let hash = 5381;\nfor (let i = 0; i < out.length; i++) hash = ((hash * 33) ^ out.charCodeAt(i)) >>> 0;";

const [name, ...rest] = process.argv.slice(2);
if (!name) throw new Error("usage: node scripts/print.ts <script> [arguments] [--hash] | hash <file> | check <file>");

const djb2 = (text: string) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16);
};

if (name === "hash") {
  const out = readFileSync(rest[0]!, "utf8");
  console.log(JSON.stringify({ length: out.length, hash: djb2(out) }));
} else if (name === "check") {
  // The same check the project's tests make when they load an export or a lint.
  const text = readFileSync(rest[0]!, "utf8");
  const at = text.lastIndexOf('  "hash"');
  const expected = at < 0 ? undefined : (/"hash":\s*"([0-9a-f]+)"/.exec(text.slice(at))?.[1]);
  if (expected === undefined) {
    console.error(`${rest[0]} has no hash line: only an export or a lint can be checked; for tokens.json use --hash and hash`);
    process.exit(1);
  }
  const actual = djb2(text.slice(0, at));
  if (actual !== expected) {
    console.error(`${rest[0]} doesn't match its hash (${actual}, expected ${expected}): save it again, exactly as returned`);
    process.exit(1);
  }
  console.log(`${rest[0]} matches its hash (${expected})`);
} else {
  const isHashOnly = rest.includes("--hash");
  const args = rest.filter((arg) => arg !== "--hash");
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), "utf8");
  const entry = /^export default (async function (\w+))/m.exec(source);
  if (!entry) throw new Error(`${name}.ts needs an "export default async function name"`);

  // The comment at the top is for people reading the file; leaving it out of the printed code makes
  // less to pass to use_figma by hand.
  const body = stripTypeScriptTypes(source).replace(/^(\/\/.*\n)+/, "").replace(entry[0], entry[1]!);
  const call = `await ${entry[2]}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`;
  console.log(
    isHashOnly
      ? `${body}\nconst out = ${call};\n${HASH}\nreturn { length: out.length, hash: hash.toString(16) };`
      : `${body}\nreturn ${call};`,
  );
}
