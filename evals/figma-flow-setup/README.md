# Eval: figma-flow:setup on an empty app, with and without Tailwind

Does the setup skill (`figma-flow/skills/setup`, formerly the figma-setup plugin) take an empty
app to a measured worked example, with no step the agent has to improvise?

The first run of the old skill (`evals/workers-comp-pages/runs/figma-setup.md`) listed 13 places
where it didn't fit: tokens read from the wrong file, a lint spec the config never ran, added files
that didn't typecheck, a Tailwind-only mapping, no font, and a worked example that measured one
value. This eval re-runs the fixed skill from scratch until a run needs no improvising.

## Setup

- **Figma**: the design file [Workers Comp Pages (eval)](https://www.figma.com/design/0Uld8qYjwyl7HJLEMwqxNv)
  (`0Uld8qYjwyl7HJLEMwqxNv`), built from the published library
  [Workers Comp Design System](https://www.figma.com/design/5OcRRw5a7qZGsgC43FjCp9)
  (`5OcRRw5a7qZGsgC43FjCp9`). Worked example: node `3:311`, the Report an injury page frame
  (a card with a header, two TextFields, a Select, a TextArea and two Buttons). Both files were
  only read.
- **Apps**, a clean copy for every run, made as `evals/workers-comp-pages` was before its setup:
  - *No Tailwind*: Vite 8, React 19, TypeScript, `@workers-comp/ui@^0.1.1` from npm (its
    `styles.css` defines the design system's variables on `:root`); `src/main.tsx` serves each
    `src/pages/<name>.tsx` at `/<name>`; tsconfig `include: ["src"]`, `types: ["vite/client"]`; no
    tests, no font served.
  - *Tailwind v4*: the same, plus `tailwindcss` 4.3 through `@tailwindcss/vite`, with
    `src/index.css` = `@import "tailwindcss";` imported after the package's CSS.
- **Agents**: one fresh Sonnet 5.5 agent per run, told to follow `SKILL.md` literally, not to
  read anything in this repo outside `figma-flow/`, not to change Figma, not to use
  session-management tools, and to log every place the skill didn't fit, quoting the line. The
  plugin wasn't installed, so its save hook wasn't running: every script was pasted into
  `use_figma` and every result saved by hand, the skill's "without the mod" path.
- **Environment**: `playwright install` can't run here; a Chromium is at `/opt/pw-browsers/chromium`
  (the agents were told both).

The two runs of a round ran at the same time. Between rounds, only the skill and its templates
changed; each round's fixes are the next section's list.

## Results

| Round | App | `test:figma` at the end | Fix rounds on the page | Improvised |
|---|---|---|---|---|
| 1 | No Tailwind | 3 of 4: Continue 38px tall, Figma 36 | 2 | port clash, body margin, Vite reload, fonts, Continue blamed on the library |
| 1 | Tailwind v4 | 3 of 4: the same | 2 | text properties, finding instance roots, Continue blamed on the library |
| 2 | No Tailwind | **4 of 4** | 0 | none of substance |
| 2 | Tailwind v4 | **4 of 4** | 0 | `w-full` on the library's fields (they set 320px) |
| 3 | No Tailwind | **4 of 4** | 1 | `box-sizing: border-box` |
| 3 | Tailwind v4 | **4 of 4** | 1 | Select options and drawn text (Figma has neither) |
| 4 | No Tailwind | **4 of 4** | 0 | none |
| 4 | Tailwind v4 | **4 of 4** | 0 | none |

Every run: typecheck and build pass; the token snapshot comes from the library's file and matches
Figma by `--hash` (17735 characters, `76d14f68`); the lint of `3:311` has no findings (`e1233206`);
the export has 12 entries (`5c4a70bd`); `print.ts check` passes both. The four `test:figma` tests
are the lint check (2), the token check (every one of the library's variables resolved in the
running app, no drift), and the page spec: all 12 entries measured with `expectPageToMatchFigma`,
none skipped. The 12 are the page, the card, the header and its two texts, the four fields and the
actions row with its two Buttons, each with its position in its parent. Runs took 4.5 to 6.5 minutes
and 35 to 54 tool calls (from the agent harness, not the agents' own estimates). Logs: `runs/round<N>-<app>.md`. Round 4's apps, as the agents left them,
are in `apps/` (`PW_CHROMIUM=/opt/pw-browsers/chromium pnpm test:figma` in either passes 4 of 4).

### Round 1

Both runs ended on the same failure: Continue rendered 38px tall against Figma's 36. Both agents
reported it as the library's. It was the page's: the actions row is a CSS flex row, which
stretches its children by default, and the outline Save draft (38px, with its border) set the
row's height. Figma's auto layout doesn't stretch. With `items-start` on the row, the Tailwind
app passed 4 of 4 (checked by hand, then reverted). The old eval's figma-flow run hit the same
thing.

Also found: the two apps shared port 5174, and `reuseExistingServer` measured the other app (my
eval's mistake, but nothing in the skill warned of it); the export has no text property values, so
building the fields needed a read of `componentProperties`; finding a library instance's outermost
element took a DOM dump; the browser's 8px body margin; a first run failing on Vite's dependency
reload; one font weight loaded where the page uses three.

Fixed for round 2: step 9 says Figma doesn't stretch and CSS does, to check a parent's alignment
before blaming the library, to read text properties, and to remove the body margin; the config
warns that it reuses any server on its port and step 3 says to check the port; the page template
says how to reach an instance's root and loads each weight; a note on the Vite reload; `print.ts`
drops each script's header comment, about a fifth less to paste for `export-node` and
`lint-node` (10.5 to 8.3 KB, 9.3 to 7.3 KB).

### Rounds 2 to 4

Round 2 passed in both apps on the first run. The Tailwind agent added `w-full` to the fields
itself: the library's TextField and Select set their own width, which a parent's stretch doesn't
override. Fixed: a fill child is `width: 100%` on the element.

Round 3 passed in both, each after one fix round. Without Tailwind, the padded card measured too
wide until the agent added `box-sizing: border-box` (Tailwind's preflight sets it). With Tailwind,
the agent had to decide what to show where an instance's `value` property differs from what the
frame draws (a placeholder), and invent the Select's options, which Figma doesn't have. Fixed:
border-box in step 9; build what the frame draws, and use named sample data where Figma has none.

Round 4 passed in both on the first run, with no fix rounds. Neither log lists a step improvised.
What they list is the cost of the no-mod path, which the skill describes: 3 to 8 KB of printed
script pasted per call and the 17 KB token snapshot written by hand, with only the hashes to show
it exact (they matched every time, in every round).

## What changed in the skill, from the old run's 13 items

1. **Tokens**: `export-tokens` reads a file's own variables; a product file holds only the
   library variables it uses, and `figma.teamLibrary` lists no collections (checked on the pages
   file). So the snapshot comes from the library's file, the skill asks for both files, and the
   script throws on a file with none of its own, naming the library collections it uses, instead
   of returning an empty snapshot.
2. **Lint spec name**: `lint.figma.spec.ts`, which the config's `*.figma.spec.ts` runs.
3. **Typecheck**: step 4 adds the tests and config to the tsconfig and `node` to its types.
4. **Mapping**: the CLAUDE.md template has examples for Tailwind and for CSS custom properties, a
   line for library components with no code yet, and says which file the node ids are in. The
   token check is a Playwright spec that resolves each variable's WEB syntax in the running app,
   so it works with any styling; the Tailwind + Vitest test is kept for a theme nothing else
   defines.
5. **Font**: when the app serves none, setup serves Figma's version (`templates/fonts.css`,
   `inter-ui@3.19.3`); a different version is reported. Specs that measure text wait for it.
6. **Worked example**: a page frame is built from the library's components and measured with
   `expectPageToMatchFigma` (`templates/tests/page.figma.spec.ts`); a component uses the
   component spec.
7. **Smaller**: the placeholder counts are per template; `PW_CHROMIUM` in the config template
   for a Chromium that isn't Playwright's build; `print.ts check` verifies an export or lint
   saved by hand (the `--hash` pair is for the token snapshot only); the skill says how to run
   scripts and save results without the mod.

## Still open

- **Without the mod, every script and result is copied through the model.** It worked in all eight
  runs and the hashes prove each saved file, but nothing checks the code that was sent, and it is
  most of a run's tool-call volume. The plugin's save hook removes the second half; nothing yet
  removes the first.
- **The page measures library instances as boxes.** What is inside a TextField or a Button is the
  library's to measure.
- **Found in passing, not fixed here:** with the plugin loaded (`claude --plugin-dir figma-flow`),
  the mod's `session.start` can't register `/figma-flow`: "refused: it is the plugin's
  /figma-flow:figma-flow". The same happens on `main`, before this change.
