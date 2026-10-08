---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with an Opus planner and a three-role subagent pipeline (implementor, simplifier, reviewer) and a capped fix loop. The main conversation orchestrates; the planner writes the plan and acceptance criteria; Sonnet and Haiku subagents do the work.
---

# Feature Flow Lite

The core of feature-flow with an Opus planner in front. The main conversation (Sonnet) asks the
planner for the plan and acceptance criteria, hands the work to Sonnet and Haiku, runs the
checks itself, and stops after two fix rounds. The planner does the thinking that needs the
strongest model, once; the main conversation only routes work and runs checks.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed (the skill was installed
somewhere that doesn't load `agents/`), use `general-purpose` with the model below, start the
prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Tools | When |
|---|---|---|---|
| `planner` | opus / medium | Read, Grep, Glob, Bash | Every run, first: reads the code, returns acceptance criteria, files, plan, checks and risks. Never edits. |
| `implementor` | sonnet / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the change and runs the checks. |
| `simplifier` | haiku / medium | Read, Edit, Grep, Glob | Only when the diff is large. Behavior-preserving cleanup. |
| `reviewer` | sonnet / high | Read, Grep, Glob, Bash | Every run, after the checks pass. For auth, payments, migrations or concurrency, pass `model: opus` and `effort: medium` on the call. |

No agent can spawn another; the main conversation spawns all of them.

## Flow

1. **Planner.** Spawn `feature-flow-lite:planner` with the user's request word for word and
   anything they said about constraints. Don't read the codebase yourself first; that's the
   planner's job.
2. **Acceptance criteria.** Use the planner's criteria as they are. Add a criterion only for
   something the user said that the planner missed, and settle its open questions with the
   reading it picked unless the user's words say otherwise.
3. **Implementor** with the handoff below, carrying the planner's FILES, PLAN and CHECKS.
4. **Checks.** Run the project's tests and linters yourself. If they fail, send the failing
   lines back to the implementor; this counts as a fix round.
5. **Simplifier**, only for a large diff; re-run the checks after it.
6. **Reviewer** with the same acceptance criteria and the planner's RISKS. It works through its
   checklist and reproduces edge cases.
7. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Stop
   after two rounds and report what passed, what still fails, and the open findings. Style
   nits are reported, not looped on.
8. **Report** the outcome and which agents ran.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <the planner's FILES>
PLAN: <the planner's PLAN>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 2, word for word>
CHECKS: <the planner's CHECKS>
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
