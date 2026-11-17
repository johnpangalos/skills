# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [feature-flow-lite](feature-flow-lite/SKILL.md) | Runs a feature or fix through a subagent pipeline: Opus writes the acceptance criteria and picks the checks the diff calls for, Haiku writes the tests first, builds and simplifies, and one well-briefed Haiku reviewer tries to break the change, in at most two fix rounds. |
| [figma-flow](figma-flow/SKILL.md) (`figma-flow:figma-flow`) | Routes a Figma node to the build that fits it, and holds what both share: lint the node for values code would have to guess at, export Figma's exact values with the scripts it carries, build with the project's own components and tokens, measure the result against those values, then have a fresh agent compare screenshots. |
| [figma-flow:component](figma-flow/skills/component/SKILL.md) | Builds or checks a Figma component or component set (variants and states) in React, measured entry by entry against Figma's exact values. A component with no code yet is built under its Figma name. |
| [figma-flow:page](figma-flow/skills/page/SKILL.md) | Builds or checks a Figma frame or screen in React from the design system's components, measured element by element (text and position) against Figma's exact values. An in-file component inside it is built with the page. |
| [figma-flow:setup](figma-flow/skills/setup/SKILL.md) | Sets a React repo up, once, to build from Figma and check the result against Figma's exact values: a measuring test, lint and token checks, the design's font, the mapping rules in CLAUDE.md and one worked example (a page built and measured, or an existing component measured). After it, "build X from Figma" works with figma-flow. Part of the figma-flow plugin; it was the separate figma-setup plugin. |
| [heavy-limiter](heavy-limiter/README.md) | A mod that makes parallel sessions on one machine take turns with heavy commands (cargo, go test, Playwright, jest, vitest, tsc, builds): one pool of cores and memory shared by every session, with fewer workers per command when it's contended. |

## Install

As Claude Code plugins, from this repo's marketplace:

```sh
/plugin marketplace add johnpangalos/skills
/plugin install feature-flow-lite@johnpangalos-skills
/plugin install figma-flow@johnpangalos-skills
/plugin install heavy-limiter@johnpangalos-skills
```

A plugin install loads each skill's subagents, hooks and mod with no workspace trust prompt. Or install the skills directly:

```sh
npx skills add johnpangalos/skills@feature-flow-lite -g
```

feature-flow-lite ships four named subagents (`feature-flow-lite:implementor` and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where its `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skill falls back to general-purpose subagents.

feature-flow-lite keeps what's true of one repo (check commands, conventions, standing criteria, the reviewer's checklist) in that repo's `FEATURE_FLOW.md`. The first run writes it from [`templates/project-criteria.md`](feature-flow-lite/templates/project-criteria.md); edit and commit it like a CLAUDE.md.

feature-flow-lite also ships a mod that needs Claude Code v2.1.287 or later and loads only where the plugin's hooks load. It keeps the acceptance criteria and triggered checks in every handoff, carries the reviewer's blocking findings into the next fix round, notes the last fix round, a test that can't fail and edits the main conversation makes itself, and prints `/ff-usage`. It only adds notes and text; it never blocks a call.

```sh
npx skills add johnpangalos/skills@figma-flow -g
```

figma-flow ships the Figma lint and export scripts (`scripts/`), one named subagent (`figma-flow:looker`, the fresh pair of eyes) and a mod. The mod writes a marked Figma `use_figma` result straight to a file, so an export is never retyped, and it holds `git commit` and `git push` after design edits until a command containing `test:figma` passes; `/figma-hold` shows what is held and `/figma-hold release` lifts it. It builds directly: in evals a pipeline of subagents reached the same result at several times the cost. The project has to supply how Figma maps to its code and a `test:figma` command, which its setup skill (`figma-flow:setup`) installs; [workers_comp](https://github.com/johnpangalos/workers_comp) is the worked example.

figma-flow's build skills are `figma-flow:component` (a component or component set) and `figma-flow:page` (a frame); the main `figma-flow` skill routes between them. Its other skill, `figma-flow:setup`, prepares a repo for them. It needs the Figma MCP and a React app with a dev server, and asks for the design's library file too when the design is built from a published library (the tokens come from there). It copies in the measuring test, the lint and token checks and the Playwright config, makes them typecheck, serves the design's font when the app serves none, writes the "Building from Figma" section of the repo's CLAUDE.md from the Figma files and the repo's styling (Tailwind or plain CSS custom properties), and proves it on one worked example: a page frame built from the library's components and measured, or an existing component measured. It reports where the code and Figma disagree and changes neither. It used to be a plugin of its own, `figma-setup`; uninstall that one and install figma-flow. Install it with the plugin: the skill runs the plugin's scripts from two folders up (`figma-flow/skills/setup/` → `figma-flow/scripts/`).
