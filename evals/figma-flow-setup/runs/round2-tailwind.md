# setup run: Tailwind v4
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: about 5 minutes of tool time (~15 minutes elapsed including model turns). Tool calls: about 35.

## Steps
1. Read the repo (~1 min). pnpm; Vite 8 on port 5182 (`pnpm dev`); Tailwind v4.3 via `@tailwindcss/vite`; `@workers-comp/ui@0.1.1` (plain CSS, defines the variables on `:root` in `styles.css`); global CSS imported in `src/main.tsx` (`@workers-comp/ui/styles.css`, `./index.css`); no test runners; `pnpm typecheck` = `tsc --noEmit` with the single `tsconfig.json` (include `src`, types `vite/client`); pages = `src/pages/<name>.tsx` served at `/<name>`; no CLAUDE.md; no font served (library CSS names "Inter", nothing loads it). Port 5182 was free.
2. Read the Figma files (~2 min). Design file has pages Report an injury (3:311), Claims inbox (4:194 plus local ClaimRow 4:187), Claim summary, Trap; every other instance is a remote (library) one. Library components: Button 1:91, Tab 18:13/TabList 18:14/TabPanel 18:21/Tabs 18:23, Badge 36:112, Chip 39:15, Checkbox 98:320/CheckboxGroup 98:334, Switch 98:49, Radio 98:83/RadioGroup 98:134, TextArea 98:133, TextField 98:232, Alert 98:250, Card parts (98:252, 254, 256, 258, 263, 321), Select 100:79 (SelectTrigger 100:43, SelectOption 100:52, Listbox 100:53). Code has Badge, Button, Chip, Select/SelectOption, Tabs/TabList/Tab/TabPanel, TextArea, TextField. No code: Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, the six Card parts. Fonts: Inter (text styles 12-60px, Regular/Medium/Semi Bold/Bold).
3. Templates (~2 min). Created `figma/` with `lint-ignore.json` = `[]`; copied `tests/figma.ts`; `playwright.config.ts` (port 5182, `./tests`, `pnpm dev`); `tests/lint.figma.spec.ts` and `tests/tokens.figma.spec.ts` (paths `../figma`, page `/`); `test:figma` = `playwright test`; installed `@playwright/test` 1.65.1 and `@types/node` 26.6.6; `.gitignore` gets `test-results`, `playwright-report`. `playwright install` not tried (told it can't run); Chromium at `/opt/pw-browsers/chromium`, run as `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`.
4. Typecheck (~30 s). Added `tests` and `playwright.config.ts` to `include` and `"node"` to `types` in `tsconfig.json`. `pnpm typecheck` passes.
5. Token snapshot (~2 min). `export-tokens` run on the library file (5OcRRw5a7qZGsgC43FjCp9) through `use_figma`; saved by hand to `figma/tokens.json` (17735 characters). `--hash` run in Figma: `{"length":17735,"hash":"76d14f68"}`; `print.ts hash` on the saved file: `{"length":17735,"hash":"76d14f68"}`. Match.
6. Font (~1 min). The app serves no Inter, so: `pnpm add inter-ui@3.19.3` (pinned exactly), copied `templates/fonts.css` to `src/fonts.css`, imported it in `src/main.tsx` before `./index.css`. Specs wait on `document.fonts.load`.
7. Token check (~1 min). Library CSS defines the variables on `:root`, so I kept the browser spec (`tests/tokens.figma.spec.ts`), not the Vitest alternative. It passes: every variable resolves to Figma's value, no drift.
8. CLAUDE.md (~3 min). Created it with the "Building from Figma" section, Tailwind-utility variant of the examples, component nodes from the library file, and the no-code list.
9. Worked example, node 3:311 page frame (~6 min). `lint-node 3:311` -> `figma/report-an-injury-lint.json`, no findings, hash e1233206, `print.ts check` ok. `export-node 3:311` -> `figma/report-an-injury.json`, 12 entries, hash 5c4a70bd, `print.ts check` ok. Read instances' `componentProperties` and layout alignment with a read-only `use_figma` call (and the Select's nested trigger text "Select a body part"). Built `src/pages/report-an-injury.tsx` (Tailwind theme utilities and `@workers-comp/ui` only), spec `tests/report-an-injury.figma.spec.ts` with an element for each of the 12 keys, no skips. First run passed (round 0 of 2): 4 tests passed, no failing values. Page URL `/report-an-injury`.
10. Own checks (~1 min). `pnpm typecheck` ok, `pnpm build` ok, `pnpm test:figma` 4 passed. The repo has no lint or other tests. Stopped my own dev server by PID (9709).
11. Report: below.

## Where the skill didn't fit (quoted)
- Step 4: "In the tsconfig the typecheck command uses, add the tests folder and `playwright.config.ts` to `include`, and `"node"` to `types` if it lists types". Fit fine; but the template spec also imports `skip`, which my page spec doesn't use. Left it (no `noUnusedLocals`). Not a skill problem.
- Page-spec template: `// Template for a page export: ... Rename the file after the page...`. I kept the template's header comment in the spec file; it reads oddly in a finished spec. Minor.
- "Running a script in Figma": "pass the printed code, whole and unchanged, as `use_figma`'s `code`." The printed code is 3-8 KB with whitespace-only lines from type stripping, and I have to retype it into the tool call, so I cannot guarantee the whitespace-only lines are byte-identical (the code behaves the same, and the output hashes match). Also the `use_figma` tool says to load a figma-use skill first; I did not (the setup skill doesn't mention it and these calls are read-only).
- Step 5: "check it with `--hash` (above)". Needed a second full paste of the export-tokens code with a changed tail, so the token check cost a duplicate 4 KB call.
- Step 9, page frame: "on a page the test can open: ... Add a spec ... `expectPageToMatchFigma` with an element or `skip("why")` for every key". The skill doesn't say how to find a library instance's outermost element; I dumped the DOM with a throwaway Playwright script (in `mktemp` dir) and used `getByLabel(...).locator("..")` and `[data-slot=select]`.
- Step 9: the library's TextField and Select set their own width (`wc-w-80`, 320px), so `self-stretch` alone did not make them 400px; I added `w-full` (the library says a consumer's utilities override). The skill only mentions `items-start`/stretch. Recorded in CLAUDE.md. (Not verified which of the two was needed; the page passed first time with both.)
- Step 3: "run `playwright install chromium` with the repo's package runner. If that can't run here..." I did not try it, because the task said it can't run; I went straight to `PW_CHROMIUM`.
- Step 11 asks for "the one line to use from now on" and to say exports come from the plugin; fine. Nothing else was missing.

## Report (as to the user)
**Needs your decision**
- Token drift: none. All 6 variable collections in the library resolve in the app to Figma's values.
- Font: the app served no Inter; I now serve Inter 3.19 (Figma's version) from `inter-ui@3.19.3`, so there is nothing to decide. `@workers-comp/ui`'s CSS names `"Inter"` and does not ship it.
- Lint findings on node 3:311: none (`figma/report-an-injury-lint.json`).
- Failing values in the worked example: none; every one of the 12 entries of "Report an injury" matches Figma (first run).
- Library components with no code yet: Checkbox (98:320), CheckboxGroup (98:334), Switch (98:49), Radio (98:83), RadioGroup (98:134), Alert (98:250), and the Card parts Card (98:321), CardHeader (98:258), CardTitle (98:252), CardDescription (98:254), CardContent (98:256), CardFooter (98:263). The "Claims inbox" page also has a ClaimRow component (4:187) made in the design file; it is the app's to build.
- Builds should run on Sonnet or Opus: Haiku on its own failed every trial run and reported success anyway.

**Added**
- `figma/` (exports folder): `tokens.json`, `report-an-injury.json`, `report-an-injury-lint.json`, `lint-ignore.json` (`[]`).
- `tests/figma.ts` (measuring helper), `tests/lint.figma.spec.ts`, `tests/tokens.figma.spec.ts`, `tests/report-an-injury.figma.spec.ts`, `playwright.config.ts` (port 5182, runs only `*.figma.spec.ts`), `test:figma` script, `@playwright/test` and `@types/node` as dev dependencies, tsconfig `include` and `types` updated, `.gitignore` entries.
- `CLAUDE.md` with the "Building from Figma" mapping section.
- `src/fonts.css` (Inter 3.19, imported in `src/main.tsx`) and `inter-ui@3.19.3`.
- `src/pages/report-an-injury.tsx`, the worked example, at `/report-an-injury`.
- Nothing committed.

**What the measurement can't read here**: anything inside a library instance (the export has each instance's box only, so the field internals are the library's to measure), the Select's listbox (a closed popover), and shadows with blur or rings drawn as separate shapes.

**This machine needs**: Playwright's own Chromium isn't installed and can't be here. Run the tests as `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`.

**From now on, say**: "build the Claims inbox page from Figma node 4:194" (it will need the ClaimRow component built first; or "build the Claim summary page from Figma node 5:41"). Exports and lints come from the figma-flow plugin, so it has to stay installed.

## Final state
`pnpm typecheck`:
```
> claims-portal-tw@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run2/tailwind
> tsc --noEmit

```
`pnpm build`:
```
vite v8.3.8 building client environment for production...
transforming...
✓ 552 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.48 kB │ gzip:  0.29 kB
dist/assets/Inter-roman.var-C-r5W2Hj.woff2   227.18 kB
dist/assets/Inter-italic.var-DhD-tpjY.woff2  245.03 kB
dist/assets/index-QPJfcTtr.css                40.74 kB │ gzip:  8.09 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-dNSKU_Bq.js      56.45 kB │ gzip: 18.15 kB
dist/assets/index-DcNbVvWa.js                213.43 kB │ gzip: 66.93 kB

✓ built in 409ms
```
`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`:
```
Running 4 tests using 2 workers

  ✓  1 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (8ms)
  ✓  2 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (15ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (1.3s)
  ✓  3 tests/report-an-injury.figma.spec.ts:30:1 › Report an injury (2.0s)

  4 passed (3.9s)
```
