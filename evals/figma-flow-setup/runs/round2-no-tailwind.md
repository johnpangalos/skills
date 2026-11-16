# setup run: no Tailwind
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: about 20 minutes. About 45 tool calls.

## Steps
1. Read the repo (1 min). pnpm; Vite 8, dev server `pnpm dev`, port 5181 (already in vite.config.ts); no Tailwind, plain CSS from `@workers-comp/ui/styles.css` (imported in `src/main.tsx`, which also auto-routes `src/pages/*.tsx` to `/<name>`); no test runner; typecheck `tsc --noEmit` on `tsconfig.json` (`include: ["src"]`, `types: ["vite/client"]`); no CLAUDE.md. The library CSS names Inter (`--font-sans`) but serves no font. No body-margin reset anywhere.
2. Read Figma (3 use_figma reads + create_session). Design file has 4 pages (Report an injury, Claims inbox, Claim summary, Trap), no local variables; all instances are remote (library). Node 3:311 uses TextField x2, Select, TextArea, Button x2. Library components: Button 1:91, Tab 18:13 (+TabList, TabPanel, Tabs), Badge, Chip, Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, TextArea, TextField, Alert, Card parts, Select. No code yet: Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, Card*. Font: Inter only.
3. Templates: `figma/lint-ignore.json` = `[]`; `tests/figma.ts`; `playwright.config.ts` (port 5181, `./tests`, `pnpm dev --strictPort`); `tests/lint.figma.spec.ts`; `tests/tokens.figma.spec.ts` (page `/`). Added `test:figma`, `@playwright/test` 1.65.1, `@types/node`, gitignore entries. Port 5181 checked free (curl 000). `playwright install chromium` was refused by the permission classifier, and the task said it can't run here, so I used `PW_CHROMIUM=/opt/pw-browsers/chromium`.
4. tsconfig: include `tests`, `playwright.config.ts`; types add `node`. Typecheck clean.
5. Tokens: export-tokens on the library file, saved as `figma/tokens.json` (17735 chars). `--hash` run in Figma: `{"length":17735,"hash":"76d14f68"}`; `print.ts hash` of the file gave the same.
6. Font: app served none, so copied `templates/fonts.css` to `src/fonts.css`, installed `inter-ui@3.19.3` (exact), imported in `src/main.tsx`.
7. Token check: kept the browser spec (no Tailwind build here, the package CSS defines the variables on `:root`). It passes: no drift, no undefined variable.
8. CLAUDE.md written from the template (no Tailwind variant, `var(...)` examples).
9. Worked example node 3:311. Lint: 0 findings, hash e1233206, `check` OK. Export: 12 entries, hash 5c4a70bd, `check` OK. Instance text properties read from `componentProperties` (labels, descriptions, error messages, placeholders, values). Built `src/pages/report-an-injury.tsx` + `.css` (library components and variables only; `body{margin:0}`; flex containers `align-items:flex-start`; actions row `justify-content:flex-end`). Spec `tests/report-an-injury.figma.spec.ts` with all 12 keys, no skips. First `test:figma` run: 4 passed, no fixing rounds needed.
10. Own checks: typecheck, build OK; test:figma 4 passed (lint x2, tokens, page). No lint script or other tests in the repo.
11. Report below.

## Where the skill didn't fit (quoted)
- "Keep the printed code in a file of its own (`mktemp`)": I printed to named files in a sibling folder `run2/plain-tmp` (outside the app folder, and not made with `mktemp`) and removed none of them. Minor.
- "Print it with `node <scripts>/print.ts <script> [<node id>…]` and pass the printed code, whole and unchanged, as `use_figma`'s `code`": the code is typed back into the tool call by the model, so exactness rests on me retyping about 3-8 KB each time; the hash checks cover it, but nothing checks the code sent. The `--hash` variant needed the whole script re-sent, not just the ending.
- "Chromium for Playwright: run `playwright install chromium`": denied by the sandbox classifier here; followed the PW_CHROMIUM route as the skill allows.
- Step 8 "the example column's variant that fits this repo's styling": the template's rows list is a menu; I wrote my own rows, which is what the step asks, but it is a judgement which kinds to include (I left effect style as "no variable, not used yet").
- Step 7 "a page whose CSS includes the app's global styles (`/` usually)": `/` (the Index) does import the library CSS via main.tsx, so it worked as written.
- The repo has no `lint` script, so step 10's "lint" had nothing to run.

## Report (as to the user)
**Needs your decision**
- Nothing is failing. Token check: no drift, every variable resolved. Lint of "Report an injury" (3:311): 0 findings. Worked example: all 12 measured values match Figma (page, card, header, two texts, four fields, actions, two buttons).
- Library components with no code yet (a design using one stops until it exists): Checkbox 98:320, CheckboxGroup 98:334, Switch 98:49, Radio 98:83, RadioGroup 98:134, Alert 98:250, Card parts (CardTitle 98:252, CardDescription 98:254, CardContent 98:256, CardHeader 98:258, CardFooter 98:263, Card 98:321). Node 3:311 uses none of them.
- Font: the app served no Inter, so I added Inter 3.19 (what Figma uses) from `inter-ui@3.19.3`. The other pages in the design file (Claims inbox, Claim summary, Trap) were not exported or linted.
- Builds should run on Sonnet or Opus; Haiku on its own failed trials and still reported success.

**Added**
- `figma/` (tokens.json, report-an-injury.json and its lint, lint-ignore.json `[]`); `tests/` (figma.ts, lint, tokens and page specs); `playwright.config.ts` (port 5181); `test:figma` script; `@playwright/test`, `@types/node`, `inter-ui@3.19.3`; tsconfig includes the tests and `node` types; `.gitignore` entries; `src/fonts.css` (imported in `src/main.tsx`); `src/pages/report-an-injury.tsx` and `.css` (at `/report-an-injury`); a "Building from Figma" section in `CLAUDE.md`. Nothing committed.

**What the measurement can't read here**: nothing found so far (no skips). Shadows and rings drawn as separate shapes would not be read.

**This machine needs**: `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma` (`playwright install chromium` can't run here).

**From now on, say**: "build the Claims inbox page from Figma node <its frame id>" (I did not look up that frame's id). Exports come from the figma-flow plugin, so it has to stay installed.

## Final state
`pnpm typecheck`:
```
> claims-portal@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run2/plain
> tsc --noEmit
```
`pnpm build`:
```
dist/assets/Inter-roman.var-C-r5W2Hj.woff2   227.18 kB
dist/assets/Inter-italic.var-DhD-tpjY.woff2  245.03 kB
dist/assets/report-an-injury-kuvDf6Mm.css      0.99 kB │ gzip:  0.37 kB
dist/assets/index-9pJsSmBp.css                25.40 kB │ gzip:  6.06 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-CzmqGbzD.js      56.19 kB │ gzip: 18.07 kB
dist/assets/index-C8pNmC-5.js                213.47 kB │ gzip: 66.94 kB

✓ built in 247ms
```
`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`:
```
Running 4 tests using 2 workers

  ✓  1 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (65ms)
  ✓  3 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (8ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (1.1s)
  ✓  2 tests/report-an-injury.figma.spec.ts:30:1 › Report an injury (1.7s)

  4 passed (4.0s)
```
