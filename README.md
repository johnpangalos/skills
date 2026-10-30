# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [feature-flow-lite](feature-flow-lite/SKILL.md) | Runs a feature or fix through a capped subagent pipeline: Opus writes the acceptance criteria and orchestrates four Haiku roles (investigator, implementor, simplifier, reviewer). |
| [feature-flow-lite-codex](feature-flow-lite-codex/SKILL.md) | feature-flow-lite for OpenAI Codex CLI: the same flow, with the four roles as Codex custom agents. |
| [figma-flow](figma-flow/SKILL.md) | Turns a Figma frame into React that matches it: export Figma's exact values with the scripts it carries, build with the project's own components and tokens, measure the result against those values, then have a fresh agent compare screenshots. |
| [figma-setup](figma-setup/SKILL.md) | Sets a React repo up, once, to build from Figma and check the result against Figma's exact values: export scripts, a measuring test, the mapping rules in CLAUDE.md and one worked example. After it, "build X from Figma" works with figma-flow, or with no skill once the values are exported. |

## Install

As Claude Code plugins, from this repo's marketplace:

```sh
/plugin marketplace add johnpangalos/skills
/plugin install feature-flow-lite@johnpangalos-skills
/plugin install figma-flow@johnpangalos-skills
/plugin install figma-setup@johnpangalos-skills
```

A plugin install loads each skill's subagents, hooks and mod with no workspace trust prompt. Or install the skills directly:

```sh
npx skills add johnpangalos/skills@feature-flow-lite -g
```

feature-flow-lite ships four named subagents (`feature-flow-lite:implementor` and so on) with their model, effort and tools pinned. They load when the skill is installed at user level (`-g`, into `~/.claude/skills/`), where its `.claude-plugin/plugin.json` makes it a skills-directory plugin. A project-level install loads them only after you accept Claude Code's workspace trust prompt. Without the agents, the skill falls back to general-purpose subagents.

feature-flow-lite keeps what's true of one repo (check commands, conventions, standing criteria, the reviewer's checklist) in that repo's `FEATURE_FLOW.md`. The first run writes it from [`templates/project-criteria.md`](feature-flow-lite/templates/project-criteria.md); edit and commit it like a CLAUDE.md.

feature-flow-lite also ships a mod (a handoff guard, a tests check and `/ff-usage`) that needs Claude Code v2.1.287 or later and loads only where the plugin's hooks load.

### feature-flow-lite-codex

For [OpenAI Codex CLI](https://github.com/openai/codex). It's a separate copy of feature-flow-lite with nothing shared, so each tool only reads instructions written for it.

```sh
git clone --depth 1 https://github.com/johnpangalos/skills
sh skills/feature-flow-lite-codex/install.sh
```

This copies the skill to `~/.agents/skills/` and the four agents (`ff_investigator`, `ff_implementor`, `ff_simplifier`, `ff_reviewer`) to `~/.codex/agents/`. Then ask for a change with `$feature-flow-lite-codex`. The agents use the session's model unless you set `model` in their files.

Compared with the Claude Code version, it has no mod, so the handoff guard and the tests check are steps in the skill and there's no usage report. Codex also can't limit a custom agent's tools, so the read-only roles are read-only by instruction. Don't install it with `codex plugin marketplace add`: Codex loads a plugin's skills only from a `skills/` folder and has no plugin agents.

```sh
npx skills add johnpangalos/skills@figma-flow -g
```

figma-flow ships the Figma export scripts (`scripts/`), one named subagent (`figma-flow:looker`, the fresh pair of eyes) and a mod. The mod writes a marked Figma `use_figma` result straight to a file, so an export is never retyped, and it holds `git commit` and `git push` after design edits until a command containing `test:figma` passes; `/figma-flow` shows what is held and `/figma-flow release` lifts it. It builds directly: in evals a pipeline of subagents reached the same result at several times the cost. The project has to supply how Figma maps to its code and a `test:figma` command, which figma-setup installs; [workers_comp](https://github.com/johnpangalos/workers_comp) is the worked example.

```sh
npx skills add johnpangalos/skills@figma-setup -g
```

figma-setup needs the Figma MCP, the figma-flow skill (which carries the export scripts) and a React app with a dev server. It copies in the measuring test, writes the "Building from Figma" section of the repo's CLAUDE.md from the Figma file and the repo's styling, and measures one existing component as a worked example. It reports where the code and Figma disagree and changes neither.
