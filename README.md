# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [feature-flow-lite](feature-flow-lite/SKILL.md) | Runs a feature or fix through a capped subagent pipeline: Opus writes the acceptance criteria and orchestrates four Haiku roles (investigator, implementor, simplifier, reviewer). |
| [figma-flow](figma-flow/SKILL.md) | Turns a Figma frame into React that matches it: build with the project's own components and tokens, have a fresh agent compare screenshots, then measure exact values against Figma's. |

## Install

```sh
npx skills add johnpangalos/skills@feature-flow-lite -g
```

feature-flow-lite ships four named subagents (`feature-flow-lite:implementor` and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where its `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skill falls back to general-purpose subagents.

feature-flow-lite keeps what's true of one repo (check commands, conventions, standing criteria, the reviewer's checklist) in that repo's `FEATURE_FLOW.md`. The first run writes it from [`templates/project-criteria.md`](feature-flow-lite/templates/project-criteria.md); edit and commit it like a CLAUDE.md.

feature-flow-lite also ships a mod (a handoff guard, a tests check and `/ff-usage`) that needs Claude Code v2.1.287 or later and loads only where the plugin's hooks load.

```sh
npx skills add johnpangalos/skills@figma-flow -g
```

figma-flow ships one named subagent (`figma-flow:looker`, the fresh pair of eyes) and a mod. The mod writes a marked Figma `use_figma` result straight to a file, so an export is never retyped, and it holds `git commit` and `git push` after design edits until a command containing `test:figma` passes; `/figma-flow` shows what is held and `/figma-flow release` lifts it. It turns Figma's exact values into acceptance criteria and a measurement to build against. It builds a component itself and hands a whole page to feature-flow-lite, so install both. It keeps its per-repo facts in a `## Figma` section of the same `FEATURE_FLOW.md`. The project has to supply how Figma maps to its code, an export script and a `test:figma` command; [workers_comp](https://github.com/johnpangalos/workers_comp) is the worked example.
