---
name: feature-flow-lite-codex
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a four-role subagent pipeline (investigator, implementor, simplifier, reviewer) and a capped fix loop. The main session orchestrates; subagents do the work.
---

# Feature Flow Lite for Codex

Four custom agents and one loop. The main session writes the acceptance criteria, hands the
work to subagents, runs the checks itself, and stops after two fix rounds. The acceptance
criteria and the reviewer's checklist matter more than the subagents' model.

## Roles

Each role is a Codex custom agent installed from this skill's `agents/` folder into
`~/.codex/agents/`, with its instructions and reasoning effort in the file. Spawn it with
`spawn_agent`, its name as `agent_type`, and the handoff below as `message`. Leave `model` and
`reasoning_effort` off the call. Don't fork your history into it; the handoff is all it needs.

| Agent | Effort | May | When |
|---|---|---|---|
| `ff_investigator` | low | read only | Only on an existing codebase too large to read the relevant parts directly. |
| `ff_implementor` | medium | read, edit, run commands | Every run: builds the change, running targeted tests as it goes and the full checks once at the end. |
| `ff_simplifier` | medium | read, edit | Only when the diff is large. Behavior-preserving cleanup. |
| `ff_reviewer` | medium | read, run commands | Every run, after the checks pass. Red team: writes and runs probes to break the change. |

Codex can't limit a subagent's tools, so the May column holds only because each agent's
instructions say so. No agent spawns another; the main session spawns all of them.

If `spawn_agent` rejects an `ff_` agent type, the agents aren't installed: say so in the report,
and spawn a default agent whose message starts with the `developer_instructions` from
`agents/<agent>.toml` in this skill's folder, followed by the handoff.

## Project file

What holds for every change in one repo lives in that repo, in `FEATURE_FLOW.md` at the repo
root: the kind of project, its check commands, its conventions for each kind of change, standing
criteria and the reviewer's checklist. Read it before step 1 of every run.

If it doesn't exist, write it first from `templates/project-criteria.md` in this skill's folder.
In an existing repo, fill it from the CI workflow, package scripts or Makefile (Checks) and from
how the last few similar changes were added (`git log --stat`, Conventions); for a new project,
fill it from the request and the kind's defaults, and add the commands once the implementor has
set them up. Keep the kind's default standing criteria and checklist only where they apply.
Don't stop to ask about it; say in the report that you wrote it so the user can edit and commit
it.

When a run teaches something the file should have said (a check CI runs that it didn't list, a
convention the final read caught, a reviewer finding that will recur), add one line to the
right section and name it in the report. Never remove a line the user wrote.

## Flow

1. **Acceptance criteria.** Before spawning anything, write a short list of testable
   statements of what done looks like. Include the requirements the request only implies and
   spell out how they combine ("filterable" plus "works without JavaScript" means the filter
   works with JavaScript off; "today" means the user's local day). For a new project, a short
   README with run instructions is a criterion. Numbers in a spec are floors. Add the project
   file's standing criteria, and its conventions for this kind of change (changelog entry,
   docs, man page, shell completions, README tables, where its tests live). If it has none for
   this kind yet, look at how a similar feature was added, require the same, and add the line
   to the project file.

   **Sibling.** In an existing repo, also find the closest existing sibling of what you're adding
   (another middleware, utility, flag, parameter type) and read it. Every behavior it has that
   the new code shares a reason for becomes a criterion: optional interfaces or methods it
   forwards, every registry, ordering table, completion or docs page it appears in
   (`git log -S<sibling name> --stat` shows where), and how it reports errors. If the new code
   wraps or stands in for something (a response writer, a stream, a handler, a parameter type),
   list every optional interface or capability the wrapped thing can have and require the new
   code to forward or handle each one the way the sibling does. Copy the sibling's user-facing
   behavior too: how it shows in help output, how its errors, bounds and defaults are worded.
   Name the sibling's path in FILES.

   **Hostile inputs.** Under each criterion that takes input, list two or three inputs a careless
   build gets wrong (malformed list members, empty, huge or zero values, values past the
   integer range, an interrupt mid-run, output that fails to write, a value that matches a
   reserved word, a case where the right answer can't be computed, where omitting beats
   emitting something wrong). They go to the implementor as cases to test and to
   the reviewer as cases to reproduce.
2. **Investigator**, only if the codebase is too large to read the relevant parts yourself.
3. **Implementor** with the handoff below. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works. The end-of-work CHECKS are the repo's own full set: the test suite plus every lint,
   format and typecheck the project runs (the project file's Checks), even ones the request
   didn't name.
4. **Checks.** Run that full set yourself, once per round. If they fail, send the failing
   lines back to the implementor; this counts as a fix round. If the implementor's run left no
   changed test file (`git status`), send it back too, unless the change genuinely needs none.
5. **Simplifier**, only for a large diff; re-run the checks after it.
6. **Reviewer** with the same acceptance criteria and hostile inputs. It is a red team: it
   writes and runs probes that try to break each criterion and hostile input, and only
   reproduced failures count as blocking. Pass along the commands it needs to run the project
   (the project file's Run it line) and its Reviewer checklist as `PROJECT CHECKLIST:`.
7. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Stop
   after two rounds and report what passed, what still fails, and the open findings. Style
   nits are reported, not looped on. Send every fix round to an implementor, even a one-line
   fix; don't edit the change yourself.
8. **Final read.** Before reporting, read the whole diff yourself against the sibling and the
   hostile inputs, as a maintainer reviewing it would. Anything they'd send back (a missing
   capability, a wrong edge case, a docs sentence the code doesn't back, an edit to an
   unrelated line) goes back to the implementor if a fix round is left; otherwise report it.
9. **Report** the outcome and which agents ran.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
PROJECT CHECKLIST: <reviewer only: the project file's Reviewer checklist, word for word>
```

Every implementor and reviewer handoff, fix rounds included, carries the whole
`ACCEPTANCE CRITERIA:` block unchanged; never shorten it to "the criteria above". The agents
already return this result format, so don't restate it:

```
STATUS: pass | fail | blocked
SUMMARY: <2-3 sentences>
FILES TOUCHED: <paths, or "none">
FINDINGS: <bulleted; reviewers tag each [blocking] or [minor]>
CHECKS: <command -> pass/fail, one line each>
OPEN QUESTIONS: <anything the main session must decide, or "none">
```

## Not for

One-line fixes (do them directly), questions (answer directly), and codebase-wide audits or
migrations across thousands of files (split them into one directory or one rule at a time).
