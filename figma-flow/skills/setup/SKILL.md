---
name: setup
description: Use once per repo to set it up for building React from Figma and checking the result against Figma's exact values. Adds the measuring test, the lint and token checks, the mapping rules in CLAUDE.md, a token snapshot and one worked example (a page or a component), then reports what doesn't line up (fonts, tokens, values with no variable). Use when the user asks to set up, bootstrap or prepare a repo for Figma-driven work.
---

# Figma Setup

One run puts in place what a later "build X from Figma" needs. In trials, a model given
these pieces (the exact values exported from Figma, the mapping rules, and a test that reports
each expected and rendered value) built a Button and a set of Tabs correctly in about 90 seconds.
The pieces did the work. This skill installs them, and proves them on one worked example.

That held for Opus and for Sonnet, which was the cheapest and fastest of the three. Haiku on
its own failed every run and reported success anyway, so say in the report that builds
should run on Sonnet or Opus.

It does not build components, and it does not change the design. Where the code and Figma
disagree, it reports the difference and leaves both alone.

## What you need first

- **The Figma files.** The design file's URL, and the node to use as the worked example: a page
  frame or a component. If the design is built from a published library (its components are
  instances of another file's, its variables are a library's), you also need the library's file:
  the tokens and the components' node ids are there. Ask once for whatever the user didn't give;
  without the design file there is nothing to set up.
- **The Figma MCP**, with `use_figma` available. If it isn't, or it refuses for a call limit,
  stop and say so: the export scripts only run inside Figma.
- **figma-flow's scripts.** This skill is part of the figma-flow plugin; the lint and export
  scripts are in the plugin's `scripts/` folder, two folders up from this file
  (`<this skill's folder>/../../scripts/`). Later builds use the plugin's figma-flow skill.
- **A React app that runs in a browser**, with a dev server. Other setups are out of scope;
  say so instead of improvising.

## Running a script in Figma

Print it with `node <scripts>/print.ts <script> [<node id>…]` and pass the printed code, whole and
unchanged, as `use_figma`'s `code`. Keep the printed code in a file of its own (`mktemp`), never a
fixed name in the shared temp folder. It is several KB, full of blanks left by type stripping;
that is expected.

- **With the plugin's mod running** (the plugin installed with its hooks), put
  `// figma-flow:save <exports folder>/<name>.json` as the code's first line: the mod writes the
  result to that file. Don't write it yourself.
- **Without it**, save the result yourself: write the tool result's text to the file exactly as
  returned, character for character, with nothing added but a final newline. Never retype, tidy or
  re-indent it. Then check the copy without reading it back:
  - an export or a lint ends in a hash of the rest: `node <scripts>/print.ts check <file>` exits 1
    unless the file matches it;
  - the token snapshot has no hash of its own: run the same script printed with `--hash` through
    `use_figma` and compare its `{ length, hash }` with `node <scripts>/print.ts hash <file>`.

  If a check fails, save it again from the tool result.

## Steps

1. **Read the repo.** Find the package manager; the dev server command and port; the styling
   system (Tailwind and its major version, CSS modules, CSS custom properties from a design
   system package, a component library); where the app imports its global CSS; the test runners
   already there; the typecheck command and the tsconfig it uses (its `include` and `types`);
   where components live; where a page can live (a playground, Storybook, an examples route, a
   pages folder, or the app itself); and which fonts the app serves and from where (an
   `@font-face`, a `<link>`, a package that ships the files; a font named in CSS is not served).
   Read CLAUDE.md if there is one.
2. **Read the Figma files.** The design file's pages, frames and components, and whether its
   components and variables come from a library (`get_libraries`, or an instance whose main
   component is remote). From the file that defines them (the library's, when there is one): the
   components, the variables with their code syntax, the text and effect styles, and the font
   families. Note each library component the code doesn't have yet.
3. **Copy the templates** from this skill's `templates/` folder, keeping the repo's own
   layout and naming where it has one:
   - Pick the exports folder, where saved Figma values will live: `figma/` at the root unless
     the repo has a better place. Nothing else goes in it. Create `lint-ignore.json` in it as
     `[]`.
   - `tests/figma.ts`: the measuring helper. No placeholders.
   - `playwright.config.ts`: fill in its three placeholders (`<PORT>`, `<TESTS DIR>`,
     `<DEV SERVER COMMAND>`). It runs only files named `*.figma.spec.ts`, so keep that ending on
     every spec you add. If the repo already has a Playwright config, add a project or a second
     config file instead of replacing it.
   - `tests/lint.figma.spec.ts`: fails while an export has no lint file of the same ids, or its
     lint has a finding not accepted in `lint-ignore.json`. Fill in its one placeholder, the
     path from the spec to the exports folder.
   - `tests/tokens.figma.spec.ts`: the token check (step 7). Fill in its two placeholders: the
     path to the exports folder, and a page whose CSS includes the app's global styles (`/`
     usually).
   - Add a `test:figma` script that runs `playwright test` (with `--config` if the config isn't
     the default one). Install `@playwright/test` and `@types/node` as dev dependencies with the
     repo's package manager, and add Playwright's output folders (`test-results`,
     `playwright-report`) to `.gitignore`.
   - Chromium for Playwright: run `playwright install chromium` with the repo's package runner.
     If that can't run here (no network, not allowed) and a Chromium is installed elsewhere, don't
     put its path in the config: the config already reads `PW_CHROMIUM`, so run the tests as
     `PW_CHROMIUM=<path> <test command>`, and say in the report that this machine needs it.
4. **Make the added files typecheck.** They use Node's APIs (`node:fs`) and run outside the app's
   source. In the tsconfig the typecheck command uses, add the tests folder and
   `playwright.config.ts` to `include`, and `"node"` to `types` if it lists types (a Vite app's
   lists `"vite/client"`). If the repo keeps a separate tsconfig for tooling (one referenced from
   the root, such as `tsconfig.node.json`), put them there instead. Run the typecheck now.
5. **Snapshot the tokens.** Run figma-flow's `export-tokens` on the file that defines the
   variables: the library's file when the design uses a library, else the design file. On a file
   with no variables or styles of its own it throws, naming the library collections its nodes
   use; run it on the library's file then. Save the result as `tokens.json` in the exports folder
   and check it with `--hash` (above).
6. **Serve the design's font.** Compare the font family and version Figma uses with what the app
   serves. A different version of the same family changes text widths (Figma's "Inter" is
   3.19; Google Fonts serves 4, about 2% narrower), and every text and hugging box is measured.
   - The app serves no font for that family (the CSS names it, nothing loads it): serve the
     version Figma uses. For Inter, copy `templates/fonts.css` beside the app's global CSS,
     install `inter-ui@3.19.3` (exactly that version) with the repo's package manager, and import
     the file once where the global CSS is imported. For another family, serve its Figma version
     the same way.
   - The app serves a different version: report it, and don't swap it. That is the user's
     decision; until then, text widths won't match.
   - Every spec waits for the font before measuring (`document.fonts.load`, as the templates do).
7. **The token check.** `tests/tokens.figma.spec.ts` resolves each variable's WEB code syntax in
   the running app and compares it with Figma's value, whatever defines the custom properties (a
   design system package's CSS, a Tailwind theme, the app's own). It runs with `test:figma`.
   A failure is token drift, or a variable the app's CSS doesn't define: report each one; don't
   change the tokens or the CSS to make it pass. One exception: on Tailwind v4, where nothing but
   the theme defines the variables and Tailwind leaves unused ones out of the CSS, the check can't
   see them. If the repo has Vitest, use `templates/tailwind/theme.test.ts` instead (next to the
   theme file, its paths fixed), and delete the browser spec; with no Vitest, keep the spec and
   report the variables it can't see.
8. **Write the mapping.** Add a "Building from Figma" section to CLAUDE.md (create the file
   if needed) from `templates/claude-section.md`. Fill every row from what you read in steps
   1 and 2, with a real example from this repo and this file in each, and keep the example
   column's variant that fits this repo's styling (Tailwind utilities, or `var(...)` CSS). Say
   which file the components' node ids are in (the library's, when there is one). List the
   library components with no code yet in their own line; they are not gaps in the mapping. A row
   you can't fill honestly is a gap: leave it out of the table and put it in the report.
9. **Make the worked example.** For the node the user named:
   - Lint it with figma-flow's `lint-node` and save the result to `<name>-lint.json` in the
     exports folder. Each finding is a question for the designer: report it, and don't accept
     one in `lint-ignore.json` without the user's reason.
   - Export it with figma-flow's `export-node`, on the same ids, to `<name>.json`. Check both
     files (above).
   - **A page frame** (a frame that isn't a component): the export has an entry for every frame
     and text under it and one per library instance. Build the page from the export with the
     mapping you just wrote: the library's components and the variables, nothing else, on a page
     the test can open. If the page uses a library component with no code, stop and report it;
     don't build it. Add a spec from `templates/tests/page.figma.spec.ts`: the viewport set to the
     frame's size, `expectPageToMatchFigma` with an element or `skip("why")` for every key of the
     export (copy the keys from the file). A skip is for an entry the helper can't read, never for
     one whose values fail.
   - **A component**: if it exists in code, add a page that renders every variant where a test
     can find it, and a spec from `templates/tests/example.figma.spec.ts`. The page doesn't have
     to look like the Figma file. If it doesn't exist in code yet, stop after the export and say
     the spec is ready to add when it is built.
   - Run `test:figma`. On a page you built, fix your page until it passes, at most two rounds;
     don't change the library, the tokens or the test. On an existing component, a failure is a
     finding about it: don't change the component. Either way, report each value still failing
     with Figma's value and the rendered value (the comparisons are soft, so one run lists them
     all). Never loosen the test.
10. **Run the repo's own checks** (typecheck, build, lint, tests) so the setup hasn't broken them.
11. **Report**, in this order: what needs the user's decision (a font version to change, token
    drift, lint findings, failing values in the example, library components with no code); what
    was added and where; what the measurement can't read in this repo; anything this machine needs
    to run it (`PW_CHROMIUM`); and the one line to use from now on, such as "build the Claims inbox
    page from Figma node 4:194". Say that exports come from the figma-flow plugin, so it has to
    stay installed.

## Rules

- Save every Figma result exactly as `use_figma` returned it, and check the copy. Never retype or
  tidy one.
- Never weaken `expectToMatchFigma` or `expectPageToMatchFigma`, delete a case, or raise an
  allowance to get a pass.
- Keep changes to what setup needs: no refactors, no restyling, no new components. The worked
  example's page and the font are the only app code it adds.
- Don't commit. Leave the changes for the user to review.

## Not for

Building or fixing components (ask for that directly once setup is done), repos that aren't
React in a browser, or re-running on a repo that is already set up: there, update the one
piece that is out of date.
