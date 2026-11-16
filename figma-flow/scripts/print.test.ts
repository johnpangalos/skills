// `node --test "figma-flow/scripts/*.test.ts"`, from the repo root: print.ts's `check`, which a
// project uses to confirm an export or a lint saved by hand is exactly what Figma returned.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const print = new URL("./print.ts", import.meta.url).pathname;
const folder = mkdtempSync(join(tmpdir(), "figma-print-"));
const check = (text: string) => {
  const file = join(folder, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, text);
  return spawnSync(process.execPath, [print, "check", file], { encoding: "utf8" });
};
// What export-node and lint-node end with: a hash of everything above the last line.
const withHash = (body: string) => {
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  return `${body}  "hash": "${hash.toString(16)}"\n}\n`;
};

test("check passes a file that matches its own hash", () => {
  const ran = check(withHash('{\n  "node": "3:311",\n  "variants": {},\n'));
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /matches its hash/);
});

test("check fails a file changed by one character", () => {
  const ran = check(withHash('{\n  "node": "3:311",\n  "variants": {},\n').replace("3:311", "3:312"));
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /doesn't match its hash/);
});

test("check refuses a file with no hash line, such as the token snapshot", () => {
  const ran = check('{\n  "Colors": {}\n}\n');
  assert.equal(ran.status, 1);
  assert.match(ran.stderr, /no hash line/);
});
