# figma-setup run on workers-comp-pages

Model: Sonnet 5.5. Total roughly 25 minutes of wall time, about 20 tool calls. The mod that saves
`figma-flow:save` results was not running, so every result was saved by hand (retyped from the tool
result: the only way without the mod, and a risk the skill's "Never retype" rule can't avoid).

## Steps

1. **Read the repo** (~2 min). pnpm; `pnpm dev` (vite) on 5174; no Tailwind, no CSS modules, no
   Vitest, no test runner at all; `@workers-comp/ui` 0.1.0 is plain compiled CSS (`dist/styles.css`,
   `:root` custom properties for colours, `--spacing`, `--text-*`, `--radius-*`, `--container-*`,
   `--breakpoint-*`, `--font-weight-*`; no shadow variables). Components live in `src/pages/` (empty;
   each file is a page at `/<name>`). No CLAUDE.md. No font is served: no `@font-face`, no `<link>`;
   `styles.css` only names `"Inter", ui-sans-serif, ...`.
2. **Read the Figma file** (~4 min). Pages: Report an injury `0:1`, Claims inbox `4:186`, Claim summary
   `5:40`, Trap `6:52`. Library components read from the design system file (Button, Tabs, Badge, Chip,
   TextArea, TextField, Select, plus Checkbox, CheckboxGroup, Switch, RadioGroup, Alert, Card with no
   code in the npm package). Variables, text styles, effect styles via export-tokens. Only font: Inter.
3. **Copied templates** (~3 min). `figma/` (exports), `tests/figma.ts`, `tests/lint.figma.spec.ts`
   (renamed, see below), `playwright.config.ts` (port 5174, `./tests`, `pnpm dev`), `figma/lint-ignore.json`
   = `[]`, script `test:figma` = `playwright test`, `@playwright/test` 1.65.1 (and `@types/node`) added
   with pnpm. `.gitignore` already had `test-results` and `playwright-report`. Added `tests` and
   `playwright.config.ts` to tsconfig `include` and `node` to `types` so typecheck covers them.
4. **Token snapshot** (~4 min). Ran in the pages file: returned empty (`textStyles: {}`, `effectStyles: {}`,
   no collections). Reran against the design system file: full snapshot. Saved as `figma/tokens.json`.
   `--hash` check: Figma `{"length":17735,"hash":"76d14f68"}`, saved file the same. Match.
5. **Mapping** (~3 min). `CLAUDE.md` created from `claude-section.md`; every row filled.
6. **Token check**: skipped (no Tailwind, no Vitest). Tokens are not checked automatically.
7. **Font**: Figma uses Inter (text styles say Inter, Regular / Medium / Semi Bold / Bold). The app serves
   no font at all, so the browser falls back to the system sans. Not Inter 3.19, not Inter 4 either.
   Reported; nothing swapped.
8. **Worked example** (~5 min), node 3:311. Lint: `figma/report-an-injury-lint.json`, no findings,
   hash `e1233206`. Export: `figma/report-an-injury.json`, hash `f657129e`, one entry only: the page
   frame (1280x772, fill #f9fafb, no label). No page or spec added: not built in code yet, so
   "stop after the export". `pnpm test:figma` runs the lint spec: 2 passed.
9. **Own checks**: `pnpm typecheck` clean, `pnpm build` clean, `pnpm test:figma` 2 passed. No lint or
   unit tests exist in the repo.
10. Report below.

## Where the skill didn't fit (quoted)

1. "Print `export-tokens` ... run it through `use_figma`, and save the result as `tokens.json`". In a
   consumer file of a published library it returns nothing: the script reads **local** variables and
   styles, and the pages file has none (they are imported). The skill never says tokens come from
   the library file; I had to run it against `5OcRRw5a7qZGsgC43FjCp9`. Also "What you need first"
   asks for one Figma file; a consumer app has two.
2. Template mismatch: `playwright.config.ts` has `testMatch: "**/*.figma.spec.ts"`, but the template
   is named `tests/figma-lint.spec.ts`, which doesn't match, so the first run says "No tests found".
   I renamed it `lint.figma.spec.ts`. The skill should name the target file.
3. "Fill in the config's three placeholders" (and "tests/figma.ts and playwright.config.ts"): the
   config has `<PORT>`, `<TESTS DIR>` and `<DEV SERVER COMMAND>`, fine, but the lint spec has a fourth
   placeholder (path to the exports folder) and the example spec several; "three" is only the config.
4. "If Chromium isn't installed for Playwright, run its install command": the env forbids it, and
   @playwright/test 1.65.1 wants `chromium_headless_shell-1255` while only 1243 exists. A launch
   works only with `executablePath`. The skill has no advice for version/browser mismatch. I did not
   add the executablePath to the config (environment-specific); a later spec run needs it.
5. Webserver: the config starts `pnpm dev` even when only the lint spec runs. Harmless, slow; the
   lint spec doesn't need a browser. Not mentioned.
6. Step 3 "keep the repo's own layout" vs tsconfig: tsconfig only included `src` and had `types:
   ["vite/client"]`, so the templates (node:fs) didn't typecheck. I added `tests`, the config and
   `@types/node`. The skill says nothing about typechecking the added files.
7. Step 5 "put a real example from this repo and this file in each" and "Components so far / Node": a
   consumer's pages use instances; the node ids are in the library file, not the pages file. I put the
   library ids and said so. The template's Node column doesn't say which file. Also the template
   assumes Tailwind utilities ("the project's own equivalent"); here the mapping is CSS variables, and
   there is no shadow variable (the effect style has no code counterpart, so I wrote the layers).
8. Step 5 "A row you can't fill honestly is a gap": components in the library without code
   (Checkbox, Switch, RadioGroup, Alert, Card) are not "rows you can't fill", but figma-flow stops on
   them. I added a "no code yet" list; the template has no place for it.
9. Step 8 "Export it with figma-flow's `export-node`, on the same ids": the export for a page frame
   with one child (Card) gives a single entry of the root (the children are only listed when the node
   lays out two or more children), so the worked example measures only a background colour and size
   (1280x772 #f9fafb). The page's real content (Card, fields, Buttons) is not exported at all; that is
   what the README predicts, but the skill would call this a done example. The page frame's width
   (1280) is also a design artifact (a fixed `breakpoint/xl` frame), not a browser layout.
10. Step 8 "lint it ... Each finding is a question for the designer": the lint stops at instances, so
    nothing inside TextField / Select / Button is checked, and it found no findings on a frame whose
    Card is a plain frame, not the library's Card component. Nothing flags that.
11. "check exports with the hash as figma-flow's SKILL.md describes": that check (`print.ts hash`
    vs `--hash`) works for tokens, where the file's hash is over the whole file. For exports and
    lints the hash in the last line is over the body, and `--hash` mode isn't offered for them in
    SKILL.md's wording; I verified them with the in-file hash (the tests do this) and the lint spec
    (passes), not with `--hash`. The skill step 8 only says "save exactly as returned".
12. figma-flow SKILL.md: `print.ts` prints an ExperimentalWarning from `stripTypeScriptTypes` to stderr
    on Node 22.23; harmless. The printed code is 9 KB for lint-node: pasting it into `use_figma` is
    manual and error-prone without the mod.
13. Step 4 says "Print export-tokens with figma-flow's scripts/print.ts": the path is the skill's, which
    is not installed here; I used `/home/user/skills/figma-flow/scripts/print.ts` directly.

## Report (as to the user)

**Needs your decision**
- Font: nothing in this app serves Inter. `@workers-comp/ui`'s CSS names `"Inter"` but ships no
  `@font-face`, and `index.html` has no font link, so text renders in the system sans and every text
  width will be off. Figma uses Inter 3.19; serve that (self-hosted) before measuring text. Not changed.
- Token drift: not checked automatically. There is no Tailwind or Vitest here, so no `theme.test.ts`.
  The package ships compiled CSS with the variables, but not a test that they match Figma.
- Library gaps: Figma has Checkbox, CheckboxGroup, Switch, RadioGroup, Alert and Card; the npm package
  (0.1.0) exports none of them. The "Report an injury" card is a plain frame (not the Card component).
- The worked example: `figma/report-an-injury.json` measures only the page frame (size and
  background); the Card and its children are not exported because the export covers a node and its
  direct children, and the page has one child. Export `3:312` (and further levels) when building.
- Lint on 3:311: no findings. Nothing was accepted in `lint-ignore.json`.

**Added**
- `figma/tokens.json` (from the design system file, hash-verified), `figma/report-an-injury.json`,
  `figma/report-an-injury-lint.json`, `figma/lint-ignore.json` (`[]`)
- `tests/figma.ts`, `tests/lint.figma.spec.ts`, `playwright.config.ts`, script `test:figma`,
  `@playwright/test`, `@types/node`; `tsconfig.json` now includes the tests; `CLAUDE.md` (mapping)
- Checks: typecheck, build and `pnpm test:figma` (2 lint tests) pass.

**The measurement can't read here**: text children (headings, paragraphs), anything below the export's
one level, shadows with blur, rings drawn as shapes, and the inside of component instances.
`test:figma` needs `executablePath: "/opt/pw-browsers/chromium"` in this sandbox to launch a browser.

**From now on**: "build the Report an injury page from Figma node 3:311" (on Sonnet or Opus: Haiku
fails). Exports come from the figma-flow skill, so it has to stay installed.
