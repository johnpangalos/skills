---
name: figma-setup
description: Use once per repo to set it up for building React from Figma and checking the result against Figma's exact values. Adds the measuring test, the mapping rules in CLAUDE.md, a token snapshot and one worked example, then reports what doesn't line up (fonts, tokens, values with no variable). Use when the user asks to set up, bootstrap or prepare a repo for Figma-driven work.
---

# Figma Setup

One run puts in place what a later "build X from Figma" needs. In trials, a model given
these pieces (the exact values exported from Figma, the
mapping rules, and a test that reports each expected and rendered value) built a Button and a
set of Tabs correctly in about 90 seconds. The pieces did the work. This skill installs them.

That held for Opus and for Sonnet, which was the cheapest and fastest of the three. Haiku on
its own failed every run and reported success anyway, so say in the report that builds
should run on Sonnet or Opus.

It does not build components, and it does not change the design. Where the code and Figma
disagree, it reports the difference and leaves both alone.

## What you need first

- **The Figma file.** Its URL, and which component to use as the worked example. If the user
  gave neither, ask once; without the file there is nothing to set up.
- **The Figma MCP**, with `use_figma` available. If it isn't, or it refuses for a call limit,
  stop and say so: the export scripts only run inside Figma.
- **The figma-flow skill**, installed. It carries the export scripts (`scripts/` in its
  folder) and is what later builds use to export. Load it to find its folder; if it isn't
  installed, stop and say so.
- **A React app that runs in a browser**, with a dev server. Other setups are out of scope;
  say so instead of improvising.

## Steps

1. **Read the repo.** Find the package manager; the dev server command and port; the styling
   system (Tailwind and its major version, CSS modules, CSS variables, a component library);
   the test runners already there; where components live; where a page that shows one
   component can live (a playground, Storybook, an examples route, or the app itself); and
   which fonts the app serves and from where. Read CLAUDE.md if there is one.
2. **Read the Figma file.** Its pages and components, its variables with their code syntax,
   its text and effect styles, and the font families it uses.
3. **Copy the templates** from this skill's `templates/` folder, keeping the repo's own
   layout and naming where it has one:
   - Pick the exports folder, where saved Figma values will live: `figma/` at the root unless
     the repo has a better place. Nothing else goes in it.
   - `tests/figma.ts` and `playwright.config.ts`: the measuring helper and its config. Fill in
     the config's three placeholders. If the repo already has a Playwright config, add a
     project or a second config file instead of replacing it.
   - Add a `test:figma` script that runs Playwright on the Figma specs, install
     `@playwright/test` with the repo's package manager,
     and add Playwright's output folders to `.gitignore`. If Chromium isn't installed for
     Playwright, run its install command for Chromium.
4. **Snapshot the tokens.** Print `export-tokens` with figma-flow's `scripts/print.ts`, run
   it through `use_figma`, and save the result as `tokens.json` in the exports folder. This
   file has no hash of its own, so check the copy: run the same script with `--hash` through
   `use_figma`, and compare its `{ length, hash }` with `print.ts hash <the saved file>`. If
   they differ, save it again.
5. **Write the mapping.** Add a "Building from Figma" section to CLAUDE.md (create the file
   if needed) from `templates/claude-section.md`. Fill every row from what you read in steps
   1 and 2, with a real example from this repo and this file in each. A row you can't fill
   honestly is a gap: leave it out of the table and put it in the report.
6. **Add the token check**, only for Tailwind v4 with Vitest: copy
   `templates/tailwind/theme.test.ts` next to the theme file and fix its paths. For any other
   styling system, skip it and say in the report that tokens are not checked automatically.
7. **Check the font.** Compare the font family and version Figma uses with the one the app
   serves. A different version of the same family changes text widths (Figma's "Inter" is
   3.19; Google Fonts serves 4, about 2% narrower). Report a mismatch; don't swap fonts.
8. **Make the worked example.** For the component the user named:
   - Export it with figma-flow's `export-node` and save the result exactly as returned (it
     ends in a hash).
   - If the component exists in code, add a page that renders every variant where a test can
     find it, and a spec from `templates/tests/example.figma.spec.ts`. The page doesn't have
     to look like the Figma file.
   - Run `test:figma`. A failure here is a finding about the existing component: report each
     one with Figma's value and the rendered value. The comparisons are soft, so one run
     lists every value that differs. Don't change the component to make it
     pass, and don't loosen the test.
   - If the component doesn't exist in code yet, stop after the export and say the spec is
     ready to add when it is built.
9. **Run the repo's own checks** (typecheck, lint, tests) so the setup hasn't broken them.
10. **Report**, in this order: what needs the user's decision (font mismatch, token drift,
    failing values in the example); what was added and where; what the measurement can't
    read in this repo; and the one line to use from now on, such as "build the Input from
    Figma node 12:34". Say that exports come from the figma-flow skill, so it has to stay
    installed.

## Rules

- Save every export exactly as `use_figma` returned it. Never retype or tidy one.
- Never weaken `expectToMatchFigma`, delete a case, or raise an allowance to get a pass.
- Keep changes to what setup needs: no refactors, no restyling, no new components.
- Don't commit. Leave the changes for the user to review.

## Not for

Building or fixing components (ask for that directly once setup is done), repos that aren't
React in a browser, or re-running on a repo that is already set up: there, update the one
piece that is out of date.
