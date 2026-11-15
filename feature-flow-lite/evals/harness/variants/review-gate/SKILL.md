---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a subagent pipeline (investigator, criteria check, implementor, simplifier) and an Opus review gate that red-teams the change and decides when it is mergeable. The main Opus conversation orchestrates; Haiku subagents do the building.
---

# Feature Flow Lite

Five named agents and one loop. The main conversation (Opus) writes the acceptance criteria while
the investigator maps the code, has them checked against the request before anything is built,
hands the work to Haiku and runs the checks itself. It never decides on its own that the work is
done: a fresh gatekeeper, a maintainer who didn't build it, red-teams the change and decides
whether it is mergeable, and the work goes back until it says yes. In
blind-judged benchmarks on features and bug fixes in real repos, this scored above plain Opus
at about the same cost, and took about two and a half times as long. Every role runs on every
task in an existing codebase: left to judgment, the investigator and simplifier were skipped in
every benchmarked run, and running them costs a few cents. The acceptance criteria and the
project's reviewer checklist matter more than the subagents' model.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed (the skill was installed
somewhere that doesn't load `agents/`), use `general-purpose` with the model below, start the
prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Tools | When |
|---|---|---|---|
| `investigator` | haiku / low | Read, Grep, Glob | Every task in an existing codebase, started in the background the moment the skill starts. Maps the code, the conventions, the closest sibling, and docs that contradict the code. |
| `criteria-checker` | opus / medium | Read, Grep, Glob | Every task, once the criteria are written and before the implementor. Checks each criterion against the request sentence by sentence and against the closest sibling. |
| `implementor` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the change, running targeted tests as it goes and the full checks once at the end. |
| `simplifier` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every task, after the checks pass. Makes the change simpler without changing behavior: splits or inlines helpers it gave a flag or mode parameter, rewrites over-engineered parts the plainer way, removes dead code. |
| `gatekeeper` | opus / high | Read, Grep, Glob, Bash | Every run, after the checks pass, and again after every fix it asks for. In one pass it red-teams the change (probes for every criterion and hostile input, the project checklist) and decides, as a maintainer who didn't build it, whether it is mergeable. |

No agent can spawn another; the main conversation spawns all of them.

The plugin also ships a mod in `hooks/` that starts once this skill is invoked. It puts the
latest `ACCEPTANCE CRITERIA:` block back into any implementor, reviewer or gatekeeper handoff that drops it,
adds a note to the result when an implementor run leaves no changed test file in the repo, and
records per-role tokens and time, which `/ff-usage` prints. It never blocks a spawn or a tool call.

## Project file

What holds for every change in one repo lives in that repo, in `FEATURE_FLOW.md` at the repo
root: the kind of project, its check commands, its conventions for each kind of change, standing
criteria and the reviewer's checklist. Read it at step 1 of every run.

If it doesn't exist, write it first from `templates/project-criteria.md` in this skill's folder.
In an existing repo, fill it from the CI workflow, package scripts or Makefile (Checks) and from
how the last few similar changes were added (`git log --stat`, Conventions); for a new project,
fill it from the request and the kind's defaults, and add the commands once the implementor has
set them up. Keep the kind's default standing criteria and checklist only where they apply.
Don't stop to ask about it; say in the report that you wrote it so the user can edit and commit
it.

When a run teaches something the file should have said (a check CI runs that it didn't list, a
convention the gatekeeper caught, a gatekeeper finding that will recur), add one line to the
right section and name it in the report. Never remove a line the user wrote.

## Flow

0. **Start the investigator now.** As the very first thing, before reading the project file,
   note the base commit (`git rev-parse HEAD`) and spawn the investigator **in the background**
   with the user's request word for word as its GOAL, asking for the files involved, the closest
   existing sibling of what's being added and every place it appears, the conventions for this
   kind of change, and docs that contradict the code. (Skip it only for a new project in an
   empty repo.) Don't wait for it: go on with steps 1 and 2 while it works.
1. **Project file.** Read `FEATURE_FLOW.md` (or write it, as above).
2. **Acceptance criteria.** Write a short list of testable
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
   the gatekeeper as cases to reproduce.
3. **Fold in the investigator.** Wait for it if it hasn't returned. Add any convention, sibling
   behavior or place the sibling appears that it found to the criteria, and its files and
   constraints to the implementor's FILES and CONSTRAINTS.
4. **Criteria check.** Spawn a fresh `criteria-checker` with the user's request word for word
   under `REQUEST:`, the acceptance criteria with their hostile inputs, and the sibling's path
   under `SIBLING:`. It flags every criterion that contradicts the request, drops something it
   says or implies, or makes a choice the request or the sibling points against. Fix every
   `[wrong]` and `[missing]` finding in the criteria before the implementor runs; if you keep a
   criterion it flagged, say why in one line (quote the request) and list it under "Criteria
   kept against the check" in the report. If a finding needs the user (the request contradicts
   itself), stop and ask.
5. **Implementor** with the handoff below. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works. The end-of-work CHECKS are the repo's own full set: the test suite plus every lint,
   format and typecheck the project runs (the project file's Checks), even ones the request
   didn't name.
6. **Checks.** Run that full set yourself, once per round. If they
   fail, send the failing lines back to the implementor.
7. **Simplifier**, on every task once the checks pass. Give it the diff and the acceptance
   criteria. Re-run the full checks after it; if it broke something, revert its edits rather
   than spending a fix round on them.
8. **Review gate.** Spawn a **fresh** gatekeeper with the user's request word for word under
   `REQUEST:`, the base commit, the acceptance criteria and hostile inputs, the full CHECKS (and
   that you just ran them on this tree, with the result), the project file's Run it line and its
   Reviewer checklist as `PROJECT CHECKLIST:`. It red-teams the change and decides whether it is
   mergeable; you don't. If it says no, send its must-fixes to the implementor, run the full
   checks, and spawn a **new** gatekeeper on the whole diff with the previous must-fixes. There
   is no round cap: the work is done only when the latest gatekeeper, run on the final diff,
   says `MERGEABLE: yes`. Nits are reported, not looped on.
   - **Criteria.** A wrong criterion the gatekeeper confirms means your criteria were wrong:
     rewrite it (and its hostile inputs), and send the corrected list with the fix. Every later
     handoff carries the corrected list.
   - **Overruling.** If a must-fix is wrong (it contradicts the request, or the gatekeeper
     misread the code), you may overrule it, but only by showing why (quote the request or
     run the command that disproves it) and listing it under "Overruled" in the report. Pass
     what you overruled to every later gatekeeper as `RULED ON:`. Re-run the gate if anything
     else changed.
   - **Thrashing.** If a fix breaks the checks, or a must-fix comes back after it was fixed,
     revert that round's edits and send the implementor a narrower handoff instead of stacking
     fixes.
   - **Only the user can decide.** If a must-fix needs the user (the request contradicts itself,
     or the fix needs a file that's off-limits), stop and report the change as not mergeable,
     with the question.
9. **Report.** The first line is `Mergeable: yes` (the latest gatekeeper said so on the final
   diff) or `Not mergeable:` and why. Then what changed, which agents ran, what the criteria
   check changed, how many gate rounds it took, the gatekeeper's DECISIONS, anything overruled,
   and every open nit. Never call the work done, finished or ready while anything you know of is
   open; list it instead.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
PROJECT CHECKLIST: <gatekeeper only: the project file's Reviewer checklist, word for word>
REQUEST: <criteria-checker and gatekeeper: the user's request, word for word>
SIBLING: <criteria-checker only: the closest sibling's path>
BASE: <gatekeeper only: the commit the change is diffed against>
```

Every criteria-checker, implementor and gatekeeper handoff carries the `ACCEPTANCE CRITERIA:` block unchanged. The
agents already return this result format, so don't restate it:

```
STATUS: pass | fail | blocked
SUMMARY: <2-3 sentences>
FILES TOUCHED: <paths, or "none">
FINDINGS: <bulleted; the gatekeeper tags each [must-fix] or [nit]>
CHECKS: <command -> pass/fail, one line each>
OPEN QUESTIONS: <anything the main conversation must decide, or "none">
```

## Not for

One-line fixes (do them directly), questions (answer directly), and codebase-wide audits or
migrations across thousands of files (suggest a dynamic workflow, starting with one directory
or one rule).
