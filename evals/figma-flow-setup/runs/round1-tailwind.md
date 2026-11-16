# setup run: Tailwind v4
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: about 5 min (300 s between the first and last command). About 40 tool calls.

## Steps
1. Read the repo (~1 min). pnpm; Vite 8, dev server `pnpm dev` on 5174; Tailwind v4.3 via `@tailwindcss/vite`; `src/index.css` is `@import "tailwindcss"`; `src/main.tsx` imports `@workers-comp/ui/styles.css` (plain CSS that defines the theme variables on `:root`), then `index.css`; pages are `src/pages/<name>.tsx` served at `/<name>`; no test runner, no CLAUDE.md, no lint script; typecheck `tsc --noEmit` with `types: ["vite/client"]`, `include: ["src"]`. No font is served (the package CSS names "Inter", has no @font-face).
2. Read the Figma files (~1 min). Design file pages: Report an injury (3:311, 1280x772), Claims inbox (local component ClaimRow 4:187), Claim summary, Trap. Node 3:311 holds instances of TextField, Select, TextArea, Button (x2), all remote (library). Library components: Button, Tab/TabList/TabPanel/Tabs, Badge, Chip, Checkbox/CheckboxGroup, Switch, Radio/RadioGroup, TextArea, TextField, Alert, Card + 5 parts, Select/SelectTrigger/SelectOption/Listbox; font Inter. Code has Badge, Button, Chip, Select(+Option), Tabs(4), TextArea, TextField; no code for Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, Card*.
3. Templates. `figma/` with `lint-ignore.json` = `[]`; `tests/figma.ts`, `playwright.config.ts` (port 5174, `./tests`, `pnpm dev`), `tests/lint.figma.spec.ts` (`../figma`), `tests/tokens.figma.spec.ts` (`../figma`, `/`); `test:figma` = `playwright test`; `@playwright/test` 1.65.1 and `@types/node` installed; `.gitignore` gets `test-results`, `playwright-report`. `playwright install` not run (no network, per the task); `PW_CHROMIUM=/opt/pw-browsers/chromium` used.
4. Typecheck. Added `tests` and `playwright.config.ts` to `include` and `"node"` to `types` in tsconfig.json. Typecheck passes.
5. Tokens. `export-tokens` on the library file (5OcRRw5a7qZGsgC43FjCp9) saved as `figma/tokens.json`; `--hash` through use_figma gave `{"length":17735,"hash":"76d14f68"}`, and `print.ts hash` on the file gave the same.
6. Font. App serves none; Figma's is Inter. Installed `inter-ui@3.19.3` (pinned, no caret), copied `templates/fonts.css` to `src/fonts.css`, imported it in `src/main.tsx` after `index.css`. Vite resolved the urls (build emits both Inter woff2 files); the page reports Inter loaded.
7. Token check. Kept the browser spec: the package's `styles.css` defines the variables on `:root`, so Tailwind's tree-shaking of unused theme variables doesn't hide them (the Vitest exception doesn't apply, and the repo has no Vitest anyway). Passes: every variable resolves to Figma's value, no drift.
8. Mapping. Wrote `CLAUDE.md` from `templates/claude-section.md`, Tailwind variant, real examples, node ids from the library file, code-less components listed on their own line.
9. Worked example (~2 min). Lint `3:311`: `{"findings": []}`, hash e1233206, `print.ts check` OK. Export `3:311`: 12 entries, hash 5c4a70bd, `check` OK. Built `src/pages/report-an-injury.tsx` (Tailwind utilities + `@workers-comp/ui`: TextField, Select, TextArea, Button) and `tests/report-an-injury.figma.spec.ts` with all 12 keys mapped (no skips). Round 1: failures on header text width (hugging), field widths (320 vs 400), and the cascading y/height. Fixed in my page (`items-start` on the header, `w-full` on the three fields and the select). Round 2: one failure left, in the library's Continue button: height 38px rendered, Figma 36px. Not mine to change; reported.
10. Own checks. typecheck passes; build passes; no lint script; no other tests.
11. Report: below.

## Where the skill didn't fit (quoted)
- "Keep the printed code in a file of its own (`mktemp`)" together with "pass the printed code, whole and unchanged, as `use_figma`'s `code`": I can only pass code as a tool argument, so I printed it to a temp file, displayed it with `cat`, and retyped it into the call by copying the displayed text. The printed code starts with a long comment block and has the type-stripping blanks; passing it whole means a very large call for each script (five calls in all). The hash checks (tokens `--hash`, `print.ts check`) were what proved the copy faithful.
- "write the tool result's text to the file exactly as returned": same issue in reverse: the only way to write the result is to re-emit it in a heredoc (17 KB for tokens.json). Verified by hash, which matched.
- Step 3, "`tests/lint.figma.spec.ts`..." and step 4 "Run the typecheck now": `tests/page.figma.spec.ts` is a template with `<PLACEHOLDERS>` that don't parse, so copying it early breaks the typecheck. I copied it only in step 9 (as `report-an-injury.figma.spec.ts`), after the first typecheck.
- Step 9, "fix your page until it passes, at most two rounds; don't change the library, the tokens or the test": the last failing value (Continue button 38px vs Figma 36px) is the library's own rendering and cannot be fixed on the page, so the test ends failing by design; I reported it.
- Step 9 page spec: "an element ... for every key" gives no way to locate the root box of a library instance that has no test id or role (TextField, TextArea, Select); I used `getByLabel(...).locator("..")` and `[data-slot="select"]`, which depends on the library's DOM.
- Step 9, text properties (descriptions, placeholder, values, error messages): the export doesn't carry them, so I read them with an extra read-only `use_figma` call (component properties of the instances). The skill doesn't mention this.
- Step 3 "run the tests as `PW_CHROMIUM=<path> <test command>`": the variable must be set on every command (an `export` did not persist between shell calls). Not a skill problem; noted.
- The templates' "Tailwind v4" exception (step 7) is worded for apps where only the theme defines the variables; here a package's plain CSS defines them, so I kept the browser spec. The skill implies this ("nothing but the theme defines the variables") but doesn't name the case.

## Report (as to the user)
**Needs your decision**
- Library vs Figma, one value: in the Report an injury example, the default-variant "Continue" Button renders 38px tall; Figma's is 36px (the outline "Save draft" is 38 in both). Width, fill, radius and label match. This is `@workers-comp/ui` 0.1.1 against the Figma library, so I changed neither. Every other measured value on the page (12 entries: the page, card, header, two header texts, four fields, the actions row, the other button) passes.
- Lint: no findings on node 3:311, nothing accepted in `lint-ignore.json`.
- Token drift: none. Every variable in `figma/tokens.json` (library file) resolves in the app to Figma's value.
- Font: the app served no Inter, so I now serve Figma's version, Inter 3.19 (`inter-ui@3.19.3`, `src/fonts.css`, imported in `src/main.tsx`).
- Library components with no code yet: Checkbox (98:320), CheckboxGroup (98:334), Switch (98:49), Radio (98:83), RadioGroup (98:134), Alert (98:250), Card (98:321) and its parts (CardHeader 98:258, CardTitle 98:252, CardDescription 98:254, CardContent 98:256, CardFooter 98:263). A page that uses one must stop and report. The worked example's card is a plain frame in the design file, so it needed none. Also, ClaimRow (4:187, "Claims inbox") is a component of the design file, not the library; the app has to build it.
- Run builds on Sonnet or Opus; Haiku on its own failed every trial and reported success anyway.

**Added**
- `figma/`: `tokens.json`, `report-an-injury.json` (export, hash 5c4a70bd), `report-an-injury-lint.json` (hash e1233206), `lint-ignore.json` (`[]`).
- `tests/`: `figma.ts`, `lint.figma.spec.ts`, `tokens.figma.spec.ts`, `report-an-injury.figma.spec.ts`; `playwright.config.ts`; `test:figma` script; `@playwright/test` and `@types/node` (dev); tsconfig `include`/`types` extended; `.gitignore` for Playwright output.
- `CLAUDE.md` "Building from Figma" (mapping, components with node ids, rules, workflow).
- App code: `src/pages/report-an-injury.tsx` (at `/report-an-injury`), `src/fonts.css` and the `inter-ui` dependency. I removed the empty `src/pages/.gitkeep`. Nothing is committed.

**What the measurement can't read here**
The insides of library components (the library's to measure) and the open Select listbox (a popover, closed on the page). Nothing was skipped in the example spec.

**This machine needs**
`playwright install chromium` can't run here, so run `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`.

**From now on**, say for example: "build the Claims inbox page from Figma node 4:186" (or any node id from the design file). Exports come from the figma-flow plugin, so it has to stay installed.

## Final state
`pnpm typecheck`:
```
> claims-portal-tw@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run/tailwind
> tsc --noEmit
```
(exit 0)

`pnpm build`:
```
dist/assets/index-CHgJXmJg.css                40.86 kB │ gzip:  8.10 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-0Y-jWNEK.js      56.28 kB │ gzip: 18.11 kB
dist/assets/index-CnjZq2yR.js                213.43 kB │ gzip: 66.93 kB

✓ built in 268ms
```

`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`:
```
Running 4 tests using 2 workers
  ✓  1 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (12ms)
  ✓  2 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (7ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (896ms)
  ✘  3 tests/report-an-injury.figma.spec.ts:19:1 › Report an injury (1.5s)
    Error: height is 38px, Figma's is 36px
  1 failed
  3 passed (3.3s)
 ELIFECYCLE  Command failed with exit code 1.
```
