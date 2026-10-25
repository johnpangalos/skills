# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [aesop](aesop/SKILL.md) | Makes Opus (or any model) build greenfield projects the way Claude Fable 5 does: small-scope, finished, honest, content-first. |
| [feature-flow-lite](feature-flow-lite/SKILL.md) | Runs a feature or fix through a capped subagent pipeline: Opus writes the acceptance criteria and orchestrates four Haiku roles (investigator, implementor, simplifier, reviewer). |

## Install

```sh
npx skills add johnpangalos/skills@aesop
npx skills add johnpangalos/skills@feature-flow-lite -g
```

feature-flow-lite ships four named subagents (`feature-flow-lite:implementor` and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where its `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skill falls back to general-purpose subagents.
