# figma-flow lint-node eval

Date: 2026-11-14. Skills at `claude/admiring-bohr-b7qvcr` (`38cf67f`), workers_comp at
`claude/admiring-bohr-b7qvcr` (`8ea236e`). Source file `5OcRRw5a7qZGsgC43FjCp9` (read only);
duplicate `z3MaWauixdCNNFPL1yLUKe` ("Workers Comp Design System (Copy)", in Drafts).

The lint was run through the Figma MCP's `use_figma`, as printed by
`node figma-flow/scripts/print.ts lint-node <ids>`, with the comments and the blank space left
by type stripping removed (the code is otherwise the printed code). Part 1 ran all seven
exports in one call that returned an array of the lint files' text.

## Part 1: the port, on the source file

Each result compared byte for byte with `workers_comp/apps/playground/figma/<name>-lint.json`
(`cmp`, plus a string comparison in Node).

| Export     | Ids                                   | Findings | Hash       | Result    |
| ---------- | ------------------------------------- | -------- | ---------- | --------- |
| badge      | 36:112                                | 0        | `79a5d1e4` | identical |
| button     | 1:91                                  | 0        | `d8d5786a` | identical |
| chip       | 39:15                                 | 0        | `ebefaddd` | identical |
| select     | 100:43 100:52 100:53 100:54 100:79    | 0        | `7acdfc2b` | identical |
| tabs       | 18:13 18:14 18:21 18:23               | 0        | `52fb206c` | identical |
| text-area  | 98:133                                | 0        | `6eccb783` | identical |
| text-field | 98:232                                | 0        | `d3c8fa81` | identical |

7 of 7 identical. No port bug found. All seven saved files have no findings, so this checks the
output format, ids, ordering and hash, not the rules themselves; part 2 checks the rules.

## Part 2: detection, on the duplicate

Plants on the Button set (1:91), one per variant:

| # | Plant | Variant | Node | Expected rule |
| - | ----- | ------- | ---- | ------------- |
| 1 | Label unlinked from `Label#1:0`, text "Buton" | `variant=outline, size=default, state=default` (1:59) | 1:60 | unlinked-text |
| 2 | Background an unbound solid `#a21cb0` | `variant=default, size=default, state=default` | 1:43 | raw-color |
| 3 | Left and right padding unbound, 13 | `variant=ghost, size=default, state=default` | 1:75 | raw-number (×2) |
| 4 | Focus ring: the two drop shadows (4px ring `#c800de`, 2px white gap) replaced by the same shadows unbound | `variant=default, size=default, state=focus` | 5:2 | raw-effect (×2) |
| 5 | Label's text style removed, font left unbound (Inter Semi Bold 12/16) | `variant=outline, size=sm, state=default` (1:67) | 1:68 | raw-type |

Notes on planting:
- Plant 4: the focus variants have no effect style in this file; their shadows are bound to
  colour variables. The plant swaps those bound shadows for identical unbound ones.
- Plant 5: removing the text style left the style's variables bound on the node (family, size,
  line height). The lint would then have reported only `fontWeight`. They were unbound too, so
  the label has no style and no font variables.

Lint of 1:91 on the duplicate (hash `f953afd5`):

```json
{"variant":"variant=default, size=default, state=default","layer":"","node":"1:43","rule":"raw-color","field":"fills","value":"#a21cb0"},
{"variant":"variant=outline, size=sm, state=default","layer":"Label","node":"1:68","rule":"raw-type","field":"textStyleId","value":"fontFamily fontSize fontWeight lineHeight"},
{"variant":"variant=ghost, size=default, state=default","layer":"","node":"1:75","rule":"raw-number","field":"paddingRight","value":13},
{"variant":"variant=ghost, size=default, state=default","layer":"","node":"1:75","rule":"raw-number","field":"paddingLeft","value":13},
{"variant":"variant=default, size=default, state=focus","layer":"","node":"5:2","rule":"raw-effect","field":"effects","value":"DROP_SHADOW"},
{"variant":"variant=default, size=default, state=focus","layer":"","node":"5:2","rule":"raw-effect","field":"effects","value":"DROP_SHADOW"},
{"variant":"variant=outline, size=default, state=default","layer":"Label","node":"1:60","rule":"unlinked-text","field":"characters","value":"Buton"}
```

- **Recall: 5 of 5.** Every plant reported with the right rule, variant and node.
- **Precision: 7 of 7 findings are plants.** Plants 3 and 4 each give two findings (one per
  padding side, one per shadow). No other findings.
- Source file re-linted afterwards: no findings, hash `d8d5786a`, same as before.

One observation: what plant 5 ran into is a likely real-world case. Detaching a text style in
Figma can leave its variables bound on the layer. The lint then reports only the fields left
unbound (here it would have been `fontWeight`), which is correct but easy to read as "nearly
fine".

## Part 3: does it change the build?

Two arms on the duplicate with all five plants in place, identical except for the skill:

- **A (lint):** figma-flow from `claude/admiring-bohr-b7qvcr`, copied without `evals/`.
- **B (no lint):** figma-flow from `main` (`94dff77`), in a detached git worktree.

The two folders differ only in `SKILL.md` and `scripts/lint-node.ts`.

### Setup

- **Fixture.** Each run started from a fresh copy of
  `feature-flow-lite/evals/harness/fixtures/figma-button` in a new git repo, with
  `pnpm install --frozen-lockfile`. `figma/button.json` and `figma/button.png` were deleted.
  The first section of `CLAUDE.md` was replaced so the design is node `1:91` in
  `z3MaWauixdCNNFPL1yLUKe`, exported with the figma-flow skill into `figma/`. The rest of
  `CLAUDE.md` is unchanged, including "Don't change `figma/`". One run (A-2) pointed out that
  conflict. No run refused to write there.
- **Command.** Your `claude -p "Build the Button from Figma with the figma-flow skill." --plugin-dir
  <arm> --model opus --output-format stream-json --verbose`, plus `--permission-mode acceptEdits
  --allowedTools Bash,Read,Edit,Write,Glob,Grep,Agent,Skill,mcp__claude_ai_Figma
  --no-session-persistence`. Without the permission flags, `-p` refuses the tool calls. The
  session's own variables (`CLAUDECODE` and the rest) were removed from the environment.
- **Plugins.** The installed `figma-flow@johnpangalos-skills` plugin was disabled in each
  fixture's `.claude/settings.json`, so only the arm's copy loaded. The init event confirmed
  this. Figma was reached through the `claude.ai Figma` connector.
- **Order.** Runs went one at a time in the order A1 B1 A2 B2 A3 B3. No rate limits.
- **Shared temp folder.** The child's sandbox gives every run the same `$TMPDIR`
  (`/tmp/claude-501`), and arm A printed its `lint.js` there. I deleted that file after each A
  run that had finished before a B run started. A-3's copy was deleted about a minute into B-3.
  Arm B's traces have no reference to lint files. A-2 also overwrote `lint.js` and `export.js`
  in that folder; another session may have been using them.

### Grades

Over 3 runs per arm, counted as Stopped / Reported, built around / Silent:

| Plant (rule) | A (lint) | B (no lint) |
| --- | --- | --- |
| "Buton", unlinked (unlinked-text) | 3 / 0 / 0 | 0 / 3 / 0 |
| `#a21cb0` fill (raw-color) | 3 / 0 / 0 | 0 / 3 / 0 |
| padding 13 (raw-number) | 3 / 0 / 0 | 0 / 3 / 0 |
| unbound focus shadows (raw-effect) | 3 / 0 / 0 | 0 / 0 / 3 |
| no text style (raw-type) | 3 / 0 / 0 | 0 / 0 / 3 |

**A, all 3 runs.** Each run linted first (`figma/button-lint.json` matched across all three
runs, apart from the hash), reported all five findings to the person with variant and node, and
stopped. None exported or built: `src/` was untouched and there was no `figma/button.json`.

**B, all 3 runs.** Each run exported, built, then found the three plants that show up as
values. It inspected those nodes, reported them as Figma defects, and shipped the value the
sibling variants use instead:
- `bg-fuchsia-700` for `#a21cb0`. B-3 identified `#a21cb0` as Tailwind v3's fuchsia-700.
- `px-4` (16) for 13.
- "Button" for "Buton".

None of the B runs hard-coded "Buton", used `px-3.25`, used an arbitrary colour, or wrote a
custom shadow.

**B missed two plants in every run.** It never mentioned the unbound focus shadows or the
missing text style. Both plants are invisible in values: the shadows and the font are exactly
what the bound versions resolve to. The export can't show them, and the build came out the same
as a build from the clean file would:
- `focus-visible:ring-2 ring-fuchsia-600 ring-offset-2`
- `text-xs`/`text-sm` `font-semibold`

They are graded Silent because they were built around without a report, not because the build
is wrong.

| Run | Result | `pnpm test:figma` at end | Cost | Turns | Wall |
| --- | --- | --- | --- | --- | --- |
| A-1 | stopped at lint | fails (no export) | $0.62 | 11 | 66 s |
| A-2 | stopped at lint | fails (no export) | $0.65 | 12 | 69 s |
| A-3 | stopped at lint | fails (no export) | $0.69 | 12 | 43 s |
| B-1 | built | 27/30, 3 fail (the 3 visible plants) | $0.84 | 17 | 159 s |
| B-2 | built, plus looker | 27/30, 3 fail | $2.09 | 32 | 731 s |
| B-3 | built, plus looker | 27/30, 3 fail | $1.66 | 28 | 184 s |

| Arm | Total cost | Mean cost | Mean wall | Mean turns |
| --- | --- | --- | --- | --- |
| A | $1.96 | $0.65 | 59 s | 11.7 |
| B | $4.59 | $1.53 | 358 s | 25.7 |

Arm A is cheaper only because it stops before building. A complete A run would also need the
designer's fixes, a second lint, and then the whole build.

**B found an issue the lint doesn't cover.** B-2 and B-3 ran the looker, which found that
Figma draws no focus ring on the ghost focus variants: the frames have no fill and don't clip.
This is a real issue in the source file, not one of the plants. Both B runs kept the ring in
code and reported it. Arm A never reached the looker, so it didn't see this.

### Verdict

**Does the lint make figma-flow builds more faithful to Figma?** It makes them more faithful
to the rule that Figma decides. Every planted defect went back to the person before any code
was written, including the two that are invisible in values. Without the lint, the builder
handled the three visible defects reasonably: it reported them and built the intended values,
not the typos. But it shipped guesses the skill forbids, and it was blind to the two
binding-only defects. Those don't change today's pixels, but they are exactly the drift the
lint exists to catch: the next change to the `fuchsia/700` variable or the `text-xs/semibold`
style wouldn't reach those variants. The cost of the lint is a hard stop with no build. Here
that is the intended behaviour, but it means even a value-neutral finding blocks the work until
a designer acts.

**Are 3 runs per arm enough?** For the direction, yes: the split is total and consistent. Every
A run stopped on every plant; no B run stopped on any. At the run level, 3/3 against 0/3 has a
one-sided Fisher p of 0.05. It isn't enough to estimate rates, or to say what A does with a
single plant. With all five planted at once, one finding is enough to stop the run, so this
doesn't show that A would stop on, say, a lone raw-type finding. It also doesn't show how B
would handle a visible defect whose sibling value is ambiguous. If you need per-rule behaviour,
a follow-up should plant one defect per run, with 5 runs per arm.

### What the runs suggest for SKILL.md

All four are now in `SKILL.md`: step 3 asks for the sibling value read from
Figma, sorts findings into visible and binding-only, and says the measurement and look haven't
run; the export-scripts section asks for `mktemp` names. The read-only export before stopping
was not adopted: reading the sibling values covers what it was for.

- **The no-export rule hides context from the person.** The lint step says "Don't export or
  build around an open finding". All A runs therefore reported without exported values, and
  A-1 and A-3 made extra `use_figma` reads to get the sibling values. A-2 skipped that and
  guessed wrong: it said the other ghost variants "likely use 12", but they use 16. Suggest:
  for each finding, report the value the sibling variants use, read from Figma, not guessed. Or
  allow the read-only export before stopping.
- **Value-neutral findings block as hard as visible ones.** The skill could ask the builder to
  sort findings when reporting: those that change what is drawn, and those that only lose a
  binding. That helps the person decide what to accept.
- **Scratch file names collide.** The skill doesn't say where to write the printed scripts.
  Agents used `$TMPDIR/lint.js` and `$TMPDIR/export.js`, which every session shares, and A-2
  overwrote another session's files. Suggest a unique name (`mktemp`) or a folder inside the
  project that git ignores.
- **Arm A never reaches the looker.** The looker catches what neither the lint nor the
  measurement does, such as the ghost focus ring here. When it stops on lint findings, the
  report should say plainly that the screenshot comparison hasn't run, so the person knows a
  clean lint isn't the last check.

### Remeasure with the updated SKILL.md (arm C)

Arm C is arm A with the four SKILL.md changes above. Setup, fixture, command and the duplicate
are all the same as before. I confirmed the plants were still in place before the runs. Arm B
wasn't re-run, because its skill didn't change.

Stopped / Reported / Silent over 3 runs: **3 / 0 / 0 for every plant**, the same as A.

| Check (new rule) | C-1 | C-2 | C-3 |
| --- | --- | --- | --- |
| Stopped on all 5 plants | yes | yes | yes |
| Gave the matching variants' value, read from Figma, and got it right | 5/5 | 5/5 | 5/5 |
| Sorted the plants correctly (visible: colour, padding, "Buton"; binding-only: effect, type) | yes | yes | yes |
| Said nothing had been measured or compared with screenshots yet | partly¹ | yes | yes |
| Printed scripts to `mktemp` names | yes | yes | yes |

¹ C-1 said nothing had been "exported, built or measured", and listed the screenshot
comparison as a later step, but didn't say a clean lint wouldn't be the last check.

Every run made a read-only `use_figma` call to get the matching variants' values. Every value
reported was right: 16 (`spacing/4`), `#a800b7` (`fuchsia/700`), "Button" linked to
`Label#1:0`, `text-xs/semibold`, and focus shadows bound to `fuchsia/600` and `white`. A-2's
wrong guess of 12 didn't recur.

| Arm | Total cost | Mean cost | Mean wall | Mean turns |
| --- | --- | --- | --- | --- |
| A (before) | $1.96 | $0.65 | 59 s | 11.7 |
| C (after) | $2.14 | $0.71 | 73 s | 13.7 |

That's about 6 cents and 14 seconds more per run, for the comparison read and the longer
report.

**Found in passing: the mod refuses absolute paths.** The mod saves a result only when the
path in `// figma-flow:save <path>` is relative (`isInside` in `hooks/register.ts` rejects
anything starting with `/`). SKILL.md doesn't say the path must be relative. B-1, C-1 and C-2
passed absolute paths, were refused with "outside the project", and wrote the file by hand.
C-2 blamed the `/tmp` symlink instead. Writing it by hand is the step the mod exists to
remove.

Fixed: `isInside` now also accepts an absolute path that lands inside the
session's working directory. Both sides are resolved through symbolic links, and a file or
folder that doesn't exist yet is resolved through its nearest existing parent. Any path
containing `..` is still refused. Two new tests in `hooks/register.test.ts` cover this; the
inside one fails on the old check. SKILL.md now says the save path is relative to the project
or absolute inside it.

The raw runs (traces, diffs, test output, lint files) were kept locally and aren't committed.
