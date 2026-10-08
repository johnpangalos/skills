# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [aesop](aesop/SKILL.md) | Makes Opus (or any model) build greenfield projects the way Claude Fable 5 does: small-scope, finished, honest, content-first. |
| [feature-flow-lite](feature-flow-lite/SKILL.md) | The recommended way to run a feature or fix: Opus writes the acceptance criteria and orchestrates four Haiku roles (investigator, implementor, simplifier, reviewer) with a capped fix loop. |
| [feature-flow](feature-flow/SKILL.md) | The full pipeline, with test writer, verifier, debugger, docs, security and migration roles on top of the core four. [Evals and benchmarks](feature-flow/evals/README.md). |

## Install

```sh
npx skills add johnpangalos/skills@aesop
npx skills add johnpangalos/skills@feature-flow-lite -g
npx skills add johnpangalos/skills@feature-flow -g
```

feature-flow-lite ships 4 named subagents and feature-flow ships 13 (`feature-flow-lite:implementor`, `feature-flow:reviewer`, and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where each skill's `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skills fall back to general-purpose subagents.
