# setup run: Tailwind v4

Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: about 5 minutes by the shell clock (first to last command). Tool calls: about 45.

## Steps

1. **Read the repo** (~1 min). pnpm; Vite 8, `pnpm dev` on port 5186 (set in `vite.config.ts`, nothing else on it); Tailwind v4.3.5 via `@tailwindcss/vite`, `src/index.css` is `@import "tailwindcss"`; `src/main.tsx` imports `@workers-comp/ui/styles.css` (library CSS, defines the Tailwind theme variables on `:root`) and `./index.css`; no test runner, no Vitest, no Playwright; typecheck is `tsc --noEmit` with tsconfig `include: ["src"]`, `types: ["vite/client"]`; pages live in `src/pages/` (route `/<file name>`); no CLAUDE.md; no font served (`--font-sans: "Inter"` named in the library CSS, no `@font-face`). `@workers-comp/ui` 0.1.1 exports Badge, Button, Chip, Select, SelectOption, Tab, TabList, TabPanel, Tabs, TextArea, TextField.
2. **Read the Figma files** (~1.5 min). Design file pages: Report an injury, Claims inbox, Claim summary, Trap. Node 3:311 is a 1280x772 frame whose instances are all remote (library) components: TextField x2, Select, TextArea, Button x2. Library pages and node ids: Button 1:91, Tab 18:13, TabList 18:14, TabPanel 18:21, Tabs 18:23, Badge 36:112, Chip 39:15, Checkbox 98:320, CheckboxGroup 98:334, Switch 98:49, Radio 98:83, RadioGroup 98:134, TextArea 98:133, TextField 98:232, Alert 98:250, Card 98:321 (+ CardTitle/Description/Content/Header/Footer), SelectTrigger 100:43, SelectOption 100:52, Listbox 100:53, Select 100:79. No code yet: Checkbox, CheckboxGroup, Switch, Radio, RadioGroup, Alert, Card parts. Font family: Inter (text styles "Inter"). Instance text properties read with a read-only `use_figma` call.
3. **Templates** (~1 min). `figma/` with `lint-ignore.json` = `[]`; `tests/figma.ts`, `tests/lint.figma.spec.ts` (path `../figma`), `tests/tokens.figma.spec.ts` (path `../figma`, page `/`); `playwright.config.ts` with port 5186, testDir `./tests`, command `pnpm dev --strictPort`; `test:figma` = `playwright test`; installed `@playwright/test` 1.65.1 and `@types/node` 26.6.6; `.gitignore` gets `test-results`, `playwright-report`. Port 5186 was free (curl). `playwright install chromium` not attempted (told it can't run here); used `PW_CHROMIUM=/opt/pw-browsers/chromium`.
4. **Typecheck** (<1 min). Added `tests` and `playwright.config.ts` to `include` and `"node"` to `types` in `tsconfig.json` (no separate tooling tsconfig). `pnpm typecheck` clean.
5. **Token snapshot**. `export-tokens` on the library file (5OcRRw5a7qZGsgC43FjCp9). Saved `figma/tokens.json`, 17735 characters. `--hash` run in Figma: `{"length":17735,"hash":"76d14f68"}`; `print.ts hash figma/tokens.json`: `{"length":17735,"hash":"76d14f68"}`. Match.
6. **Font**. The app serves no Inter. Copied `templates/fonts.css` to `src/fonts.css`, installed `inter-ui@3.19.3` (exact), imported `./fonts.css` in `src/main.tsx` after `./index.css`. Build emits the Inter var woff2 files.
7. **Token check**. Kept the browser spec (not the Vitest one): the library's CSS defines every variable on `:root`, so the check can see them (the Tailwind v4 exception does not apply; the repo has no Vitest anyway). Result: passes, no drift.
8. **Mapping**. Wrote `CLAUDE.md` from `templates/claude-section.md` (Tailwind variant of the examples, library node ids, no-code list). Every row filled.
9. **Worked example, node 3:311 (page frame)**. Lint: 0 findings, `figma/report-an-injury-lint.json` hash e1233206, `print.ts check` matches. Export: 12 entries, `figma/report-an-injury.json` hash 5c4a70bd, `print.ts check` matches. Read instance properties: Date of injury (placeholder drawn, `value` "2026-11-12" set but not drawn), Select "Body part" invalid (placeholder "Select a body part", error message drawn, description hidden), TextArea, Employer (disabled, placeholder "Employer" drawn, `value` "Northwind Logistics" set but not drawn), Buttons "Save draft" outline / "Continue" default. Built `src/pages/report-an-injury.tsx` (route `/report-an-injury`) with Tailwind utilities and `@workers-comp/ui`; `items-start` on flex containers, `w-full` on the filling elements; Select options are sample data. Spec `tests/report-an-injury.figma.spec.ts` from the page template, all 12 keys mapped to elements, no skip. First run of `test:figma`: 4 passed (no fix rounds needed).
10. **Repo checks**. typecheck clean, build OK, `test:figma` 4 passed (see Final state). The repo has no lint script and no other tests.
11. **Report**. Below.

## Where the skill didn't fit (quoted)

1. Step 3: "Chromium for Playwright: run `playwright install chromium` ... If that can't run here ... run the tests as `PW_CHROMIUM=<path> <test command>`". Followed as told (the task said installing can't run); I did not try the install. No gap.
2. Step 3, `sed` of the config placeholders: the template's header comment contains the text "Replace the three placeholders: <PORT>, <TESTS DIR> and <DEV SERVER COMMAND>." so the substitution also rewrote that comment ("... placeholders: 5186, ./tests and pnpm dev --strictPort."). Harmless, left as is.
3. Step 3: "Where the dev server can be told to fail on a busy port (Vite's `--strictPort`), put that in `<DEV SERVER COMMAND>`." I used `pnpm dev --strictPort`. Fine, but not a problem of the skill.
4. Step 9, "build what the frame draws: where a property and the drawn text differ (a `value` set, a placeholder shown), the drawn text". For Date of injury and Employer the visible text layers were the Placeholder; I inferred "drawn" from the visible TEXT layers (`visible` filter on `findAllWithCriteria`) rather than a screenshot. It matched the test, but the skill does not say how to find what is drawn.
5. Step 9, Select: "where Figma has nothing to say (a Select's options), sample data". Used four body parts, named as sample data in the page comment and in the report.
6. Step 9: `figma.ts`/page template says "A library instance's element is its component's outermost element ... step out to the outermost one (`.locator("..")` from the label". Used `getByText(label, {exact:true}).locator("..")` for TextField, Select and TextArea; worked first time. No gap.
7. Running scripts: the printed code has long whitespace-only lines left by type stripping, which I had to paste as-is into the `code` parameter by hand (a copy of ~8 KB of text). It worked and the hash check passed, but the skill gives no way to pass a file to `use_figma`; only pasting. Not a deviation.
8. Dev server cleanup: I started `pnpm dev` once myself to inspect while writing the spec; killing the `pnpm` wrapper PID left its `vite` child running, so I killed that child by its PID before the final runs (so the config started its own server). Not a skill issue.

## Report (as to the user)

**Needs your decision**
- Nothing is failing. Lint of node 3:311: 0 findings. Token check: no drift (every Figma variable resolves in the app to Figma's value). Worked example: every measured value of the page matches Figma (12 entries, none skipped).
- Font: the app served no Inter (the library CSS names it, nothing loaded it). I now serve Inter 3.19 (the version Figma uses) from `inter-ui@3.19.3` through `src/fonts.css`, imported in `src/main.tsx`. This is the one change to app code besides the page.
- Library components with no code yet, so a design that uses one can't be built until they exist: Checkbox (98:320), CheckboxGroup (98:334), Switch (98:49), Radio (98:83), RadioGroup (98:134), Alert (98:250), Card and its parts (98:321, 98:252, 98:254, 98:256, 98:258, 98:263). The page built here uses none of them.
- Sample data: the page's Select options (Head, Back, Hand, Leg) are mine; Figma draws none.
- Builds should run on Sonnet or Opus: Haiku on its own failed every trial and still reported success.

**Added**
- `figma/`: `tokens.json` (from the library file), `report-an-injury.json` and `report-an-injury-lint.json` (node 3:311), `lint-ignore.json` (`[]`).
- `tests/`: `figma.ts`, `lint.figma.spec.ts`, `tokens.figma.spec.ts`, `report-an-injury.figma.spec.ts`; `playwright.config.ts`; script `test:figma`; dev dependencies `@playwright/test`, `@types/node`; `.gitignore` entries for Playwright output; `tsconfig.json` includes the tests and config and has the `node` types.
- `CLAUDE.md` with the "Building from Figma" mapping.
- `src/fonts.css` and `inter-ui@3.19.3`; `src/pages/report-an-injury.tsx` at `/report-an-injury`.
- Nothing is committed.

**What the measurement can't read here**: nothing known yet. The token check runs in the browser and sees the library's variables because `@workers-comp/ui/styles.css` defines them on `:root`.

**This machine**: Playwright's Chromium can't be installed here; run `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`.

**From now on**: "build the Claims inbox page from Figma node 4:186" (the Claims inbox page is on page 4:186 of the design file; use the frame's node id). The exports come from the figma-flow plugin, so it has to stay installed.

## Final state

`pnpm typecheck`:
```
> claims-portal-tw@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run4/tailwind
> tsc --noEmit

```

`pnpm build` (tail):
```
dist/assets/index-DBdL7iUG.css                40.88 kB │ gzip:  8.10 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-D9og7WWS.js      56.35 kB │ gzip: 18.09 kB
dist/assets/index--zDkw3Uz.js                213.43 kB │ gzip: 66.93 kB

✓ built in 307ms
```

`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma` (tail):
```
> claims-portal-tw@ test:figma /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run4/tailwind
> playwright test


Running 4 tests using 2 workers

  ✓  1 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (7ms)
  ✓  3 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (14ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (692ms)
  ✓  2 tests/report-an-injury.figma.spec.ts:19:1 › Report an injury (1.1s)

  4 passed (2.8s)
```
