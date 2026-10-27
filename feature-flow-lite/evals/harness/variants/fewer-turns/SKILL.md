---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a three-role subagent pipeline (investigator, implementor, reviewer) and a capped fix loop. The main Opus conversation orchestrates; Haiku subagents do the work.
---

# Feature Flow Lite

Three named agents and one loop. The main conversation (Opus) writes the acceptance criteria,
hands the work to Haiku, runs the checks itself, and stops after two fix rounds. Every role
runs on every task in an existing codebase: left to judgment, the investigator was skipped in
every benchmarked run, and running it costs a few cents. Simplicity is built in, not cleaned up
after: the investigator names the code to copy the shape of, the implementor writes the plain
version first, and the reviewer blocks structure the request didn't ask for.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed (the skill was installed
somewhere that doesn't load `agents/`), use `general-purpose` with the model below, start the
prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Tools | When |
|---|---|---|---|
| `investigator` | haiku / low | Read, Grep, Glob | Every task in an existing codebase, first. Maps the code, the conventions, similar code to copy the shape of, shared helpers not to stretch, and docs that contradict the code. |
| `implementor` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the plain version of the change, running targeted tests as it goes and the full checks once at the end, then strips its own leftovers. |
| `reviewer` | haiku / medium | Read, Grep, Glob, Bash | Every task, after a passing check run. Works through its checklist, including simplicity. |

No agent can spawn another; the main conversation spawns all of them. Spawn each one in the
foreground (`run_in_background: false`) and act on its result in the same turn it returns:
a background agent costs you a status message and a wake-up turn for every spawn.

Every turn of yours is an Opus call on the critical path, so keep them few. Don't read or
grep the code or the diff yourself: the investigator's report is your map, and the
implementor and reviewer read what they need. Don't re-run a command whose result an agent's CHECKS line
already reports; your one full check run per round is the only check you run. Don't edit
files yourself, and don't post progress messages between steps.

## Flow

1. **Investigator**, on every task in an existing codebase (skip it only for a new project in
   an empty repo). In the same message, name the stages you'll run in one line and spawn it
   with the request.
2. **Acceptance criteria and handoff**, in one step when the investigator returns. Write a
   short list of testable statements of what done looks like. Include the requirements the
   request only implies and spell out how they combine ("filterable" plus "works without
   JavaScript" means the filter works with JavaScript off; "today" means the user's local
   day). For a new project, a short README with run instructions is a criterion. Numbers in a
   spec are floors. In an existing repo, list its conventions for this kind of change as
   criteria, from the investigator's report of how a similar feature was added (its changelog
   entry, docs, man page, shell completions, README tables, where its tests live). Criteria
   describe behavior, not design: don't call for a refactor, base class, shared helper or new
   abstraction unless the request asks for one. A new piece follows the shape of the code
   beside it, and copying that shape is fine. "More are coming" is not a request for a
   framework. Put the investigator's findings in the handoff under FILES and CONSTRAINTS and
   spawn the implementor in the same message.
3. **Implementor** with the handoff below. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works.
4. **Checks.** Run the project's full test suite and linters yourself, once per round, in one
   Bash call (chain them with `;` and print each one's exit status). If they fail, send the
   failing lines back to the implementor; this counts as a fix round.
5. **Reviewer** with the same acceptance criteria. It works through its checklist and
   reproduces edge cases.
6. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Stop
   after two rounds and report what passed, what still fails, and the open findings. Style
   nits are reported, not looped on, and not fixed by you.
7. **Report** in under ten lines: the outcome, the check results, open findings, and which
   agents ran.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
```

Every handoff starts with GOAL. The investigator's has GOAL, FILES and CONSTRAINTS (it runs
before the criteria exist); every implementor and reviewer handoff carries the
`ACCEPTANCE CRITERIA:` block unchanged. The agents already return this result format, so
don't restate it:

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
