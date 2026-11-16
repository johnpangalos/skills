# setup run: no Tailwind
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: roughly 25 minutes. About 45 tool calls.

## Steps
1. Read the repo (~2 min). pnpm; `pnpm dev` = vite on port 5183 (set in vite.config.ts); styling is plain CSS custom properties from `@workers-comp/ui/styles.css` (Tailwind v4 output, but the app has no Tailwind); global CSS imported in `src/main.tsx`; no test runners; typecheck `tsc --noEmit` with tsconfig `include: ["src"]`, `types: ["vite/client"]`; pages are `src/pages/<name>.tsx` served at `/<name>`; no CLAUDE.md. The package CSS names `"Inter"` in `--font-sans` but ships no font, and the app serves none. Nothing on port 5183.
2. Read Figma (~3 min). Design file pages: Report an injury (3:311), Claims inbox (ClaimRow component 4:187), Claim summary, Trap. All instances in 3:311 are remote library instances (TextField x2, Select incl. nested SelectTrigger, TextArea, Button x2). Library components listed with `use_figma` (page.findAllWithCriteria). Code has Button, Tabs set, Badge, Chip, TextArea, TextField, Select/SelectOption; none for Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, Card parts. `get_libraries` not called.
3. Templates (~3 min). `figma/` with `lint-ignore.json` `[]`; `tests/figma.ts`, `tests/lint.figma.spec.ts`, `tests/tokens.figma.spec.ts`, `playwright.config.ts` (port 5183, testDir `./tests`, command `pnpm dev --strictPort`); `test:figma` script; `@playwright/test@1.65.1`, `@types/node` installed; `.gitignore` extended. `playwright install chromium` was blocked by the permission classifier (and the task said it can't run), so tests run with `PW_CHROMIUM=/opt/pw-browsers/chromium`.
4. Typecheck: added `tests` and `playwright.config.ts` to `include` and `"node"` to `types`; passes.
5. Tokens: ran export-tokens on the library file (5OcRRw5a7qZGsgC43FjCp9) (did not first run it on the design file to see it throw). Saved `figma/tokens.json` by hand (17735 chars). `--hash` run in Figma: `{length:17735, hash:"76d14f68"}`; `print.ts hash` of the file: identical.
6. Font: Figma uses Inter, app served none: copied `fonts.css` to `src/fonts.css`, installed `inter-ui@3.19.3`, imported after the package CSS in `src/main.tsx`.
7. Token check: placeholders filled (page `/`). Passes: all variables resolve to Figma's values, no drift.
8. CLAUDE.md "Building from Figma" written (CSS-variable variant), with component table, no-code list, ClaimRow note, rules.
9. Worked example node 3:311 (a page frame). Lint: no findings, hash e1233206, saved `figma/report-an-injury-lint.json`, `print.ts check` OK. Export: hash 5c4a70bd, 12 entries, saved `figma/report-an-injury.json`, `check` OK. Instance text properties were read with a read-only `use_figma` call. Built `src/pages/report-an-injury.tsx` + `.css` from the library's components. Spec `tests/report-an-injury.figma.spec.ts` generated from the export's keys (no skips). Round 1 failed (body 8px margin, content-box widths, header not `width:100%`); fixed in the page CSS; round 2 passed, 4 of 4 tests.
10. Own checks: typecheck, build pass; no lint or other tests in the repo.
11. Report below.

## Where the skill didn't fit (quoted)
- "Chromium for Playwright: run `playwright install chromium` with the repo's package runner." The run was told it can't run here and the classifier denied it; I used `PW_CHROMIUM` straight away, as the next lines allow.
- "A page the test can open... `<PAGE URL>`" for the tokens spec says "`/` usually": the app's index page imports the global CSS, so `/` was fine. No problem, noted only.
- Step 9 page: "if no CSS in the app removes the body's margin, the page does." Nothing says border-box is also needed; the card's padded widths failed (content-box) until I added `box-sizing: border-box` to the page's elements. The skill's fix list mentions only alignment and `width: 100%`.
- "Save the result yourself: write the tool result's text to the file exactly as returned" with the mod absent: this means retyping a 17 KB result through a heredoc; the hash check caught nothing wrong, but there is no way to copy it without retyping.
- Step 5: "On a file with no variables or styles of its own it throws... run it on the library's file then." I went to the library directly and did not run the design file first.
- Page template's `skip()` and the `<PAGE NAME>` examples: I generated the spec from the export keys with a script rather than "copy the keys from the file" by hand; same result.

## Report (as to the user)
**Needs your decision**
- Nothing blocks. Token check: no drift (every variable resolves to Figma's value). Lint of node 3:311: no findings. Font: the app served no Inter, so I added Inter 3.19 (`inter-ui@3.19.3`); nothing to decide.
- The worked example (Report an injury, 3:311) passes: 12 entries, none skipped, every value matches Figma after two small fixes in my page (body margin, border-box, header width).
- Library components with no code yet: Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, Card (CardTitle, CardDescription, CardContent, CardHeader, CardFooter, Card). The design file's own ClaimRow (4:187) is the app's to build. A design that uses any of them needs that component built first.
- Run builds on Sonnet or Opus; Haiku on its own failed every trial and reported success anyway.

**Added**
- `figma/` (tokens.json, report-an-injury.json and -lint.json, lint-ignore.json `[]`); `tests/` (figma.ts, lint, tokens and report-an-injury specs); `playwright.config.ts`; `test:figma` script; `src/fonts.css`; `src/pages/report-an-injury.tsx` and `.css`; the "Building from Figma" section in `CLAUDE.md`; tsconfig `include`/`types`; dev dependencies `@playwright/test`, `@types/node`, `inter-ui`. Nothing committed.

**What the measurement can't read here**: shadows with blur, rings drawn as shapes, positions after several text-hugging siblings; the Select's open listbox and hover/pressed/focus states are not covered by the page export.

**This machine needs** `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma` (Playwright's Chromium can't be installed here).

**From now on**, say e.g. "build the Claims inbox page from Figma node 4:187". Exports come from the figma-flow plugin, so it has to stay installed.

## Final state
$ pnpm typecheck

> claims-portal@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run3/plain
> tsc --noEmit

$ pnpm build
dist/assets/report-an-injury-DQMzceCe.js      56.29 kB │ gzip: 18.07 kB
dist/assets/index-B5q_nCpy.js                213.47 kB │ gzip: 66.94 kB

✓ built in 235ms
$ PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma


Running 4 tests using 2 workers

  ✓  2 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (11ms)
  ✓  1 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (7ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (691ms)
  ✓  3 tests/report-an-injury.figma.spec.ts:16:1 › Report an injury (1.1s)

  4 passed (2.0s)
