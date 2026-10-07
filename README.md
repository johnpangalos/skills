# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [aesop](aesop/SKILL.md) | Makes Opus (or any model) build greenfield projects the way Claude Fable 5 does: small-scope, finished, honest, content-first. |
| [feature-flow](feature-flow/SKILL.md) | Runs a feature or fix through a capped, cost-aware subagent pipeline: Opus orchestrates, Sonnet and Haiku investigate, implement, verify and review. [Evals](feature-flow/evals/README.md). |

## Install

```sh
npx skills add johnpangalos/skills@aesop
npx skills add johnpangalos/skills@feature-flow -g
```

feature-flow ships 13 named subagents (`feature-flow:implementor`, `feature-flow:reviewer`, and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where its `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skill falls back to general-purpose subagents.
