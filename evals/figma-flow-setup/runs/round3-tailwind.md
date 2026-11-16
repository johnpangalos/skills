# setup run: Tailwind v4
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: roughly 10-12 minutes (about 4 minutes of it in tool time since the first command). About 30 tool calls.

## Steps
1. Read the repo (~1 min). pnpm; Vite 8 dev server on port 5184 (in vite.config.ts); Tailwind v4.3 via @tailwindcss/vite, `@import "tailwindcss"` in src/index.css; `@workers-comp/ui/styles.css` imported in src/main.tsx and it defines the theme variables on :root; no Vitest, no test runner, no CLAUDE.md; typecheck = `tsc --noEmit`, tsconfig include ["src"], types ["vite/client"]; pages are src/pages/<name>.tsx at /<name> (empty folder); no @font-face anywhere (the ui package has none), so Inter is named but not served. Port 5184 free.
2. Read Figma (~1 min). Design file pages: Report an injury, Claims inbox, Claim summary, Trap. Instances are of the library (main component remote). Library: 13 component pages; 7 variable collections (Colors 101, Spacing 35, Radius 9, Typography 31, Container 13, Breakpoint 5, Border 1); 40 text styles, 7 effect styles; font Inter (Regular, Medium, Semi Bold). Code has Button, Tabs/TabList/Tab/TabPanel, Badge, Chip, TextArea, TextField, Select/SelectOption. No code for Alert, Card (+parts), Checkbox/CheckboxGroup, Switch, Radio/RadioGroup.
3. Templates copied (~2 min). figma/ with lint-ignore.json `[]`; tests/figma.ts; playwright.config.ts (port 5184, ./tests, `pnpm dev --port 5184 --strictPort`); lint and tokens specs (path ../figma, page `/`). Added @playwright/test 1.65.1 and @types/node 26.6.6, `test:figma` script, .gitignore entries. `playwright install chromium` not run (told it can't be): used PW_CHROMIUM=/opt/pw-browsers/chromium.
4. Typecheck (~10 s): added "tests" and "playwright.config.ts" to include and "node" to types; typecheck passes.
5. Tokens: export-tokens on the library file, saved by hand to figma/tokens.json; `--hash` run in Figma gave {length 17735, hash 76d14f68}, `print.ts hash` of the file gives the same.
6. Font: app served none, so installed inter-ui@3.19.3 (exact), copied templates/fonts.css to src/fonts.css, imported it first in src/main.tsx.
7. Token check: kept the browser spec (no Vitest). The ui package's CSS defines all variables on :root, so it sees them. It passes: no token drift.
8. CLAUDE.md written (new file) from the template, Tailwind variant, with node ids from the library file and the no-code list.
9. Worked example, node 3:311 (page frame). Lint saved to figma/report-an-injury-lint.json: no findings, hash e1233206, `check` ok. Export saved to figma/report-an-injury.json: 12 entries, hash 5c4a70bd, `check` ok. Read componentProperties of the 6 instances with a read-only use_figma. Built src/pages/report-an-injury.tsx and tests/report-an-injury.figma.spec.ts. Run 1: one failure (the Header frame was 185.9px wide, Figma's 400); fixed with `w-full` on the header (round 1 of 2). Run 2: 4 passed. No skips.
10. Own checks: typecheck, build pass (no lint or tests of the repo's own exist).
11. Report below.

## Where the skill didn't fit (quoted)
- Step 3, "Chromium for Playwright: run `playwright install chromium` ... If that can't run here ... run the tests as `PW_CHROMIUM=<path> <test command>`": the task said it can't run, so I did not try it; I used the path given.
- Step 3, the config's `<DEV SERVER COMMAND>`: the skill doesn't say whether to pass the port; I used `pnpm dev --port 5184 --strictPort` so a busy port fails instead of serving another app.
- Step 5, "Save the result as `tokens.json` ... Without it, save the result yourself ... character for character": the 17 KB result had to be retyped into a heredoc from the tool output (I have no way to pipe a tool result to a file). The hash check caught nothing wrong, but this is the one place a copy error is likely.
- Step 6, "import the file once where the global CSS is imported": the global CSS is imported in src/main.tsx (not index.html); I added `import "./fonts.css"` as its first line.
- Step 9, "Add a spec from `templates/tests/page.figma.spec.ts`": the template's font list uses `<SIZE>`/`<FAMILY>` for two weights; the page also uses weight 500 (labels), so I loaded 400, 500 and 600.
- Step 9, "the export has sizes and styles but not the instances' text properties": the properties list a `value` ("2026-11-12", "Northwind Logistics") that the drawn instances don't show (they show the placeholder). I built from the drawn text (placeholders), not the property values. The Select's options are not in Figma at all (only "Select a body part" is drawn), so the four body-part options are invented.
- Step 9, the Select's element: the skill says use the component's outermost element; I used `getByText("Body part").locator("..")` and it passed, but I did not inspect the DOM to confirm it is the outermost element.
- Step 8, "What the measurement can't read": I wrote "nothing known yet" plus a note about the Select's listbox and focus rings, which is a guess, not something I measured.

## Report (as to the user)
**Needs your decision:** nothing blocking. Token check: all 195 Figma variables resolve to the same values in the app (no drift). Lint of the worked example (node 3:311, "Report an injury"): no findings. Font: the app served no Inter at all, so I added Inter 3.19.3 (the version Figma uses). The worked example's measurement passes in full (every frame, text and instance; none skipped). Two things to know: the design shows the Select with no options (I made up four body parts), and the Continue button's fill is fuchsia-700 (#a800b7), as in the library. Library components with no code yet (stop and report if a design uses one): Alert (98:250), Card and its parts (98:321, 98:258, 98:252, 98:254, 98:256, 98:263), Checkbox (98:320), CheckboxGroup (98:334), Switch (98:49), Radio (98:83), RadioGroup (98:134). None of them is used by Report an injury; the other pages (Claims inbox, Claim summary, Trap) were not checked.

**Added:**
- `figma/`: tokens.json, report-an-injury.json, report-an-injury-lint.json, lint-ignore.json (empty).
- `tests/`: figma.ts, lint.figma.spec.ts, tokens.figma.spec.ts, report-an-injury.figma.spec.ts; `playwright.config.ts` (port 5184); `test:figma` script; @playwright/test, @types/node, inter-ui@3.19.3.
- `src/fonts.css` (imported in src/main.tsx), `src/pages/report-an-injury.tsx` (served at /report-an-injury), CLAUDE.md ("Building from Figma"), tsconfig include/types updated, .gitignore entries. Nothing committed.

**What the measurement can't read here:** nothing found so far; the Select's open listbox and focus rings are not on the page, so they are not measured.

**This machine needs:** `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma` (Playwright's own Chromium can't be installed here).

**Builds should run on Sonnet or Opus** (Haiku failed in trials and reported success). **Exports come from the figma-flow plugin, so it has to stay installed.**

From now on, say: "build the Claims inbox page from Figma node 4:186" (or the node id of the frame you want).

## Final state
`pnpm typecheck`:
```
> claims-portal-tw@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run3/tailwind
> tsc --noEmit
```
`pnpm build`:
```
dist/assets/index-C88VbXvL.css                40.60 kB │ gzip:  8.01 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-Ty3HhKB-.js      56.32 kB │ gzip: 18.09 kB
dist/assets/index-D9ncBTNw.js                213.43 kB │ gzip: 66.93 kB

✓ built in 501ms
```
`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`:
```
Running 4 tests using 2 workers

  ✓  1 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (7ms)
  ✓  2 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (12ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (818ms)
  ✓  3 tests/report-an-injury.figma.spec.ts:15:1 › Report an injury (1.3s)

  4 passed (3.0s)
```
