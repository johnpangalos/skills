# setup run: no Tailwind
Model: Sonnet 5.5 (claude-sonnet-5-5). Wall time: about 4 to 5 minutes by the clock from the first repo read (my own measurement was 251 s; tool latency not separately counted). Tool calls: about 33.

## Steps
1. Read the repo (~20 s). pnpm; `pnpm dev` = vite on 5185; no Tailwind, plain CSS custom properties from `@workers-comp/ui/styles.css` (imported in `src/main.tsx`); no test runner; `typecheck` = `tsc --noEmit` with `include: ["src"]`, `types: ["vite/client"]`; `src/pages/*.tsx` are pages at `/<name>` (glob in main.tsx); no CLAUDE.md. Font: the library CSS names `"Inter"` in `--font-sans` but has no `@font-face` and index.html has no `<link>`, so the app serves none. Library CSS has no body margin reset (the only `margin: 0` is at line 741, not on body).
2. Read the Figma files (~30 s, 2 `use_figma` reads). Design file pages: Report an injury (3:311, 1280x772), Claims inbox (ClaimRow component 4:187, frame 4:194), Claim summary (5:41), Trap (6:40). Instances in 3:311 are all remote (library): TextField x2, Select, TextArea, Button x2. Library has 25 components/sets; collections Colors, Spacing, Radius, Typography, Container, Breakpoint, Border; 40 text styles; 7 shadow styles; font Inter. Code has Badge, Button, Chip, Select/SelectOption, Tabs/TabList/Tab/TabPanel, TextArea, TextField; no code for Alert, Card (+5 parts), Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, Listbox.
3. Templates (~40 s). `figma/` with `lint-ignore.json` = `[]`; `tests/figma.ts`, `tests/lint.figma.spec.ts`, `tests/tokens.figma.spec.ts` (paths `../figma`, page `/`); `playwright.config.ts` (port 5185, `./tests`, `pnpm dev --strictPort`); `test:figma` = `playwright test`; added `@playwright/test` 1.65.1 and `@types/node` 26.6.6; `.gitignore` gained `test-results`, `playwright-report`. Port 5185 was free when checked. Chromium not installed via playwright; used `PW_CHROMIUM=/opt/pw-browsers/chromium`.
4. Typecheck (~5 s). Added `tests` and `playwright.config.ts` to `include`, `"node"` to `types`; `pnpm typecheck` clean.
5. Tokens (~30 s). export-tokens run on the library file (5OcRRw5a7qZGsgC43FjCp9). Saved `figma/tokens.json` (17735 chars). `--hash` script run in Figma: `{"length":17735,"hash":"76d14f68"}`; `print.ts hash` on the file: identical.
6. Font (~10 s). App serves none, so `inter-ui@3.19.3` installed (exact), `templates/fonts.css` copied to `src/fonts.css`, imported first in `src/main.tsx`.
7. Token check. `tests/tokens.figma.spec.ts` kept; passes with no drift (all variables resolve to Figma values).
8. CLAUDE.md written from the template (no Tailwind variant, `var(...)` CSS). Gaps: none left out of the table; effect-style row says none is used yet.
9. Worked example, page frame 3:311 (~90 s). Lint: no findings, `figma/report-an-injury-lint.json`, hash e1233206, `print.ts check` OK. Export: 12 entries, `figma/report-an-injury.json`, hash 5c4a70bd, `print.ts check` OK. Read instances' `componentProperties` (read-only). Built `src/pages/report-an-injury.tsx` + `.css` (page bg gray-50, padding 48 top/bottom, centered column; card `container-md` wide, p-6, gap-6, radius-lg, `align-items: flex-start`; children `width: 100%`; actions row `justify-end`, gap 3). Drawn text used: placeholder shown for both TextFields (Figma sets `value` "2026-11-12" and "Northwind Logistics" but draws the placeholder); Select invalid with errorMessage. Select options are sample data (Head, Back, Hand, Leg). Spec `tests/report-an-injury.figma.spec.ts`, every key mapped, no skips. First `test:figma` run: 4 passed, no fix rounds needed.
10. Repo checks: `pnpm typecheck` and `pnpm build` pass. The repo has no lint script and no other tests.
11. Report: below.

## Where the skill didn't fit (quoted)
- "Keep the printed code in a file of its own (`mktemp`)... pass the printed code, whole and unchanged, as `use_figma`'s `code`." The code has to be pasted into the tool call by hand (7 to 8 KB each), so the "unchanged" can only be checked by the output hash; blank/whitespace-only lines left by type stripping were reproduced as best I could (not byte-checked). Results hashed correctly, so no impact.
- "Save the result yourself: write the tool result's text to the file exactly as returned" and "the token snapshot has no hash of its own": the 17 KB tokens.json had to be retyped via the Write tool, which is the thing the Rules say never to do; only the `--hash` round trip (another full paste of the script into Figma) proves it. It matched, but it cost a second 3.5 KB call.
- "`PW_CHROMIUM=<path> <test command>`": `/opt/pw-browsers/chromium` is an executable file, not a folder; fine, but the skill doesn't say to check which.
- Step 9 "`expectPageToMatchFigma` with an element or `skip(...)` for every key": the template says to find library instances by role/label then "step out to the outermost one (`.locator("..")`... checked once against the component's DOM)". For TextField/TextArea `getByLabel(...).locator("..")` was the outer column; for Select `getByText("Body part", {exact:true}).locator("..")` worked. It passed first run, but I did not separately inspect the DOM to confirm these are the outermost elements beyond the passing size/position checks.
- Step 9 says the Select options are "sample data, named as such in the report"; I named them in the page's comment and the report.
- "Where the dev server can be told to fail on a busy port (Vite's `--strictPort`), put that in `<DEV SERVER COMMAND>`": used `pnpm dev --strictPort`. During the run another evaluation's vite (run3, a different directory, its own port) was running; I did not touch it.
- Step 8 "Fill every row... with a real example from this repo": no effect style is used in the example, so that row has no real example; I wrote that honestly instead of inventing one. Also the "Card" frame in the design is a plain frame, not the library's Card; noted in CLAUDE.md.

## Report (as to the user)
**Needs your decision**
- Nothing failed. Token check: no drift between Figma's variables and `@workers-comp/ui`'s CSS. Lint of node 3:311: no findings. Worked example: all 12 entries match Figma, no failing values.
- Font: the app served no Inter, so I added Inter 3.19.3 (the version Figma uses) with `inter-ui@3.19.3`, `src/fonts.css`, imported first in `src/main.tsx`. This is the one change to app code besides the page.
- Library components with no code yet (stop and report if a design uses one): Alert, Card (CardHeader, CardTitle, CardDescription, CardContent, CardFooter), Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, Listbox (only inside Select). The Card in the worked example is a plain frame, built as page CSS.
- Sample data: the Select's options (Head, Back, Hand, Leg) are mine; Figma shows none. For the two TextFields Figma sets a `value` ("2026-11-12", "Northwind Logistics") but draws the placeholder, so the page draws the placeholder.
- The claims inbox's `ClaimRow` (4:187) is made in the design file, not the library, so it's the app's to build when you build that page.
- Builds should run on Sonnet or Opus: Haiku on its own failed every trial and reported success anyway.

**Added**
- `figma/`: `tokens.json` (library snapshot), `report-an-injury.json` and `report-an-injury-lint.json` (hashes 5c4a70bd, e1233206), `lint-ignore.json` (`[]`).
- `tests/figma.ts`, `tests/lint.figma.spec.ts`, `tests/tokens.figma.spec.ts`, `tests/report-an-injury.figma.spec.ts`; `playwright.config.ts` (port 5185, `pnpm dev --strictPort`); `test:figma` script; devDependencies `@playwright/test`, `@types/node`; dependency `inter-ui@3.19.3`; tsconfig `include`/`types` extended; `.gitignore` entries.
- `src/pages/report-an-injury.tsx` and `.css` (served at `/report-an-injury`), `src/fonts.css`, and a "Building from Figma" section in `CLAUDE.md`.
- Nothing is committed. Typecheck and build pass; the repo has no lint script or other tests.

**What the measurement can't read here**: shadows with blur, text colours inside library components, hover/focus/pressed looks and the open Select listbox.

**This machine needs**: Playwright's Chromium can't be installed here, so run `PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma`.

**From now on, say**: "build the Claims inbox page from Figma node 4:194". Exports come from the figma-flow plugin, so it has to stay installed.

## Final state
```
$ pnpm typecheck
> claims-portal@ typecheck /tmp/claude-0/-home-user-skills/c9034934-f1ea-504d-a34c-cb60a7a305e6/scratchpad/run4/plain
> tsc --noEmit

$ pnpm build   (tail)
dist/index.html                                0.48 kB │ gzip:  0.29 kB
dist/assets/Inter-roman.var-C-r5W2Hj.woff2   227.18 kB
dist/assets/Inter-italic.var-DhD-tpjY.woff2  245.03 kB
dist/assets/report-an-injury-CselM4xA.css      1.07 kB │ gzip:  0.39 kB
dist/assets/index-CQQ3VvHN.css                25.33 kB │ gzip:  6.01 kB
dist/assets/jsx-runtime-Am8b9ysO.js            8.27 kB │ gzip:  3.12 kB
dist/assets/report-an-injury-CpcGmSCT.js      56.22 kB │ gzip: 18.03 kB
dist/assets/index-B9idHCgo.js                213.47 kB │ gzip: 66.94 kB

✓ built in 264ms

$ PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma
Running 4 tests using 2 workers

  ✓  1 tests/lint.figma.spec.ts:39:3 › report-an-injury passes the Figma lint (11ms)
  ✓  2 tests/lint.figma.spec.ts:55:1 › every accepted lint finding still occurs (6ms)
  ✓  4 tests/tokens.figma.spec.ts:21:1 › every Figma variable resolves in the app to Figma's value (679ms)
  ✓  3 tests/report-an-injury.figma.spec.ts:17:1 › Report an injury (1.2s)

  4 passed (2.9s)
```
