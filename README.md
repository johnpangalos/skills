# skills

Agent skills by [@johnpangalos](https://github.com/johnpangalos).

| Skill | What it does |
|---|---|
| [feature-flow-lite](feature-flow-lite/SKILL.md) | Runs a feature or fix through a capped subagent pipeline: Opus writes the acceptance criteria and orchestrates four Haiku roles (investigator, implementor, simplifier, reviewer). |
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

### feature-flow-lite on OpenAI Codex CLI

Codex reads the same `SKILL.md`, but not the Claude Code agents or mod, so the skill carries a Codex installer. It needs Node 18 or later.

```sh
git clone --depth 1 https://github.com/johnpangalos/skills
node skills/feature-flow-lite/codex/install.mjs                 # roles use the session's model
node skills/feature-flow-lite/codex/install.mjs --model <name>  # or pin a cheaper model for them
```

It copies the skill to `~/.agents/skills/`, generates the four roles as Codex custom agents (`~/.codex/agents/ff_*.toml`) from `agents/*.md`, and registers [`codex/hooks.mjs`](feature-flow-lite/codex/hooks.mjs) in `~/.codex/hooks.json`. Trust the hooks once with `/hooks` in Codex, then ask for a change with `$feature-flow-lite`; `$ff-usage` prints per-role tokens and time. Re-run it after pulling to update; `--uninstall` removes it.

The differences from Claude Code: Codex can't limit a custom agent's tools, so the read-only roles are read-only by instruction; the hooks put dropped criteria back as context when the subagent starts rather than into its handoff; and an implementor run that changed no test file is sent back once rather than flagged.

```sh
npx skills add johnpangalos/skills@figma-flow -g
```

figma-flow ships the Figma export scripts (`scripts/`), one named subagent (`figma-flow:looker`, the fresh pair of eyes) and a mod. The mod writes a marked Figma `use_figma` result straight to a file, so an export is never retyped, and it holds `git commit` and `git push` after design edits until a command containing `test:figma` passes; `/figma-flow` shows what is held and `/figma-flow release` lifts it. It builds directly: in evals a pipeline of subagents reached the same result at several times the cost. The project has to supply how Figma maps to its code and a `test:figma` command, which figma-setup installs; [workers_comp](https://github.com/johnpangalos/workers_comp) is the worked example.

```sh
npx skills add johnpangalos/skills@figma-setup -g
```

figma-setup needs the Figma MCP, the figma-flow skill (which carries the export scripts) and a React app with a dev server. It copies in the measuring test, writes the "Building from Figma" section of the repo's CLAUDE.md from the Figma file and the repo's styling, and measures one existing component as a worked example. It reports where the code and Figma disagree and changes neither.
