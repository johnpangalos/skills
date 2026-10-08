---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a four-role subagent pipeline (investigator, implementor, simplifier, reviewer) and a capped fix loop. The main Opus conversation orchestrates; Haiku subagents do the work.
---

# Feature Flow Lite

Four named agents and one loop. The main conversation (Opus) writes the acceptance criteria,
hands the work to Haiku, runs the checks itself, and stops after two fix rounds. In
blind-judged benchmarks on features and bug fixes in real repos, this scored above plain Opus
at about the same cost, and took about two and a half times as long. The acceptance criteria
and the reviewer's checklist matter more than the subagents' model.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed (the skill was installed
somewhere that doesn't load `agents/`), use `general-purpose` with the model below, start the
prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Tools | When |
|---|---|---|---|
| `investigator` | haiku / low | Read, Grep, Glob | Only on an existing codebase too large to read the relevant parts directly. |
| `implementor` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the change, running targeted tests as it goes and the full checks once at the end. |
| `simplifier` | haiku / medium | Read, Edit, Grep, Glob | Only when the diff is large. Behavior-preserving cleanup. |
| `reviewer` | haiku / medium | Read, Grep, Glob, Bash | Every run, after the checks pass. For auth, payments, migrations or concurrency, pass `model: opus` and `effort: medium` on the call. |

No agent can spawn another; the main conversation spawns all of them.

## Flow

1. **Acceptance criteria.** Before spawning anything, write a short list of testable
   statements of what done looks like. Include the requirements the request only implies and
   spell out how they combine ("filterable" plus "works without JavaScript" means the filter
   works with JavaScript off; "today" means the user's local day). For a new project, a short
   README with run instructions is a criterion. Numbers in a spec are floors. In an existing
   repo, list its conventions for this kind of change as criteria: look at how a similar
   feature was added (its changelog entry, docs, man page, shell completions, README tables,
   where its tests live) and require the same.
2. **Investigator**, only if the codebase is too large to read the relevant parts yourself.
3. **Implementor** with the handoff below. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works.
4. **Checks.** Run the project's full test suite and linters yourself, once per round. If they
   fail, send the failing lines back to the implementor; this counts as a fix round.
5. **Simplifier**, only for a large diff; re-run the checks after it.
6. **Reviewer** with the same acceptance criteria. It works through its checklist and
   reproduces edge cases.
7. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Stop
   after two rounds and report what passed, what still fails, and the open findings. Style
   nits are reported, not looped on.
8. **Report** the outcome and which agents ran.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
```

Every implementor and reviewer handoff carries the `ACCEPTANCE CRITERIA:` block unchanged. The
agents already return this result format, so don't restate it:

```
STATUS: pass | fail | blocked
SUMMARY: <2-3 sentences>
FILES TOUCHED: <paths, or "none">
FINDINGS: <bulleted; reviewers tag each [blocking] or [minor]>
CHECKS: <command -> pass/fail, one line each>
OPEN QUESTIONS: <anything the main conversation must decide, or "none">
```

## Not for

One-line fixes (do them directly), questions (answer directly), and codebase-wide audits or
migrations across thousands of files (suggest a dynamic workflow, starting with one directory
or one rule).
