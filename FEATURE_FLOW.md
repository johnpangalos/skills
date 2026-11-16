# Feature Flow: skills

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Library of Claude Code skills and plugins (Markdown skills, TypeScript scripts run by Node's own
type stripping, Claude Code mods), with evals. No CI: the checks below are run by hand.

## Checks

- Full: `node --test "figma-flow/scripts/*.test.ts"` (export-node and export-tokens against a fake Figma, print.ts check)
- Full: `claude plugin test figma-flow` (the mod's tests in `hooks/register.test.ts`; it also tries to load
  the scripts' and templates' tests and reports them as not loading, which is expected)
- Full: `cd figma-flow/scripts && pnpm install && pnpm typecheck`
- Full, when the setup skill's templates (`figma-flow/skills/setup/templates`) or figma-flow's scripts change: in `evals/workers-comp-pages`,
  `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm test:figma` (set
  `PW_CHROMIUM=/opt/pw-browsers/chromium` where Playwright's own browser build isn't installed)
- Targeted: `node --test figma-flow/scripts/export-node.test.ts`
- Run it: a script prints as Figma plugin code with `node figma-flow/scripts/print.ts <script> <ids>`
  and runs through the Figma MCP's `use_figma`; the eval app runs with `pnpm dev` (port 5174).

## Conventions

- Change to a figma-flow script: its behaviour described in the comment at the top of the script
  and in figma-flow/SKILL.md's script list; a test in `figma-flow/scripts/*.test.ts`.
- Change to the setup skill's templates: the eval app's copies (`evals/workers-comp-pages/tests/figma.ts`,
  `tests/tokens.figma.spec.ts`) updated to match, and its `test:figma` passing.
- Plugin versions (`.claude-plugin/marketplace.json`, each plugin's `plugin.json`) are bumped in a
  PR of their own.
- An eval records what was run, on what, and what happened, in its README, with each agent's log.

## Standing criteria

- The existing tests still pass.
- An export saved before the change still loads where it did (workers_comp's component exports),
  or the change says why not.
- A skill's text says what its scripts and templates actually do.

## Reviewer checklist

- The change follows the patterns around it; anything the sibling named in FILES does that the new
  code should and doesn't is a finding.
- Every sentence a SKILL.md, a template comment or an eval README adds matches what the code does
  or what was run.
- An export's last line is a hash of everything above it, and the helper checks it.
