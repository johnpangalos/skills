---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a subagent pipeline (investigator, implementor, simplifier, reviewer) and a council of ten Haiku councillors that decides when the change is done. The main Opus conversation orchestrates; Haiku subagents do the work.
---

# Feature Flow Lite

Five named agents and two loops. The main conversation (Opus) writes the acceptance criteria,
hands the work to Haiku and runs the checks itself. It never decides on its own that the work is
done: a council of ten councillors, maintainers who didn't build it, each decide whether the
change is mergeable. Any no is investigated, and the work goes back until no confirmed must-fix
is left. In
blind-judged benchmarks on features and bug fixes in real repos, this scored above plain Opus
at about the same cost, and took about two and a half times as long. Every role runs on every
task in an existing codebase: left to judgment, the investigator and simplifier were skipped in
every benchmarked run, and running them costs a few cents. The acceptance criteria and the
reviewer's checklist matter more than the subagents' model.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed (the skill was installed
somewhere that doesn't load `agents/`), use `general-purpose` with the model below, start the
prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Tools | When |
|---|---|---|---|
| `investigator` | haiku / low | Read, Grep, Glob | Every task in an existing codebase, first. Maps the code, the conventions, similar code to copy the shape of, and docs that contradict the code. |
| `implementor` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the change, running targeted tests as it goes and the full checks once at the end. |
| `simplifier` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every task, after the checks pass. Makes the change simpler without changing behavior: splits or inlines helpers it gave a flag or mode parameter, rewrites over-engineered parts the plainer way, removes dead code. |
| `reviewer` | haiku / medium | Read, Grep, Glob, Bash | Every run, after the checks pass. Red team: writes and runs probes to break the change. |
| `councillor` | haiku / xhigh | Read, Grep, Glob, Bash | Every run, last: ten at once, and ten more after every fix. Each is a maintainer who didn't build the change and decides whether it is mergeable. |

No agent can spawn another; the main conversation spawns all of them.

The plugin also ships a mod in `hooks/` that starts once this skill is invoked. It puts the
latest `ACCEPTANCE CRITERIA:` block back into any implementor or reviewer handoff that drops it,
adds a note to the result when an implementor run leaves no changed test file in the repo, and
records per-role tokens and time, which `/ff-usage` prints. It never blocks a spawn or a tool call.

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
2. **Investigator**, on every task in an existing codebase (skip it only for a new project in
   an empty repo). Give it the request and your acceptance criteria. Pass its findings into the
   implementor's handoff under FILES and CONSTRAINTS, and add any convention it finds to the
   acceptance criteria.
3. **Implementor** with the handoff below. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works. The end-of-work CHECKS are the repo's own full set: the test suite plus every lint,
   format and typecheck the project runs (the project file's Checks), even ones the request
   didn't name.
4. **Checks.** Run that full set yourself, once per round. If they
   fail, send the failing lines back to the implementor; this counts as a fix round.
5. **Simplifier**, on every task once the checks pass. Give it the diff and the acceptance
   criteria. Re-run the full checks after it; if it broke something, revert its edits rather
   than spending a fix round on them.
6. **Reviewer** with the same acceptance criteria and hostile inputs. It is a red team: it
   writes and runs probes that try to break each criterion and hostile input, and only
   reproduced failures count as blocking. Pass along the commands it needs to run the project
   (the project file's Run it line) and its Reviewer checklist as `PROJECT CHECKLIST:`.
7. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Stop
   after two rounds and move on to the council, carrying any open findings. Style nits are
   reported, not looped on.
8. **Council.** Note the base commit before the implementor first runs (`git rev-parse
   HEAD`). Run the full checks, then spawn **ten fresh** councillors in one message, so they run
   in parallel, numbered `SEAT: 1` to `SEAT: 10`. Each gets the user's request word for word
   under `REQUEST:`, the base commit, the acceptance criteria, the full CHECKS with the output of
   your run, and the project file's Run it line. They decide whether the change is mergeable;
   you don't.
   - **Investigating.** If every councillor says yes, the council passes. If any says no, merge
     their must-fixes (the same problem from several seats is one item) and investigate each
     one yourself: re-run its repro command, or write the smallest probe in a `mktemp -d`
     directory, and read the code it points at. A must-fix is **confirmed** if it reproduces, or
     if it is a missing convention, a docs mismatch or a leftover file you can see. It is
     **dismissed** only with evidence: the command that shows it doesn't happen, or the line of
     the request it contradicts. Never dismiss one because few councillors raised it.
   - **Fixing.** Send every confirmed must-fix to the implementor (with any open reviewer
     findings), run the full checks, and convene a **new** council of ten on the whole diff.
     There is no round cap: the work is done only when the latest council, run on the final
     diff, has no confirmed must-fix (every no-vote in it was investigated and dismissed).
   - **Thrashing.** If a fix breaks the checks, or a must-fix comes back after it was fixed,
     revert that round's edits and send the implementor a narrower handoff instead of stacking
     fixes.
   - **Only the user can decide.** If a must-fix needs the user (the request contradicts itself,
     or the fix needs a file that's off-limits), stop and report the change as not mergeable,
     with the question.
9. **Report.** The first line is `Mergeable: yes` (the latest council, on the final diff, left
   no confirmed must-fix) or `Not mergeable:` and why. Then what changed, which agents ran, how
   many council rounds it took and each round's vote (yes/no out of 10), every must-fix you
   dismissed with its evidence, the councillors' DECISIONS, and every open nit. Never call the
   work done, finished or ready while anything you know of is open; list it instead.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
PROJECT CHECKLIST: <reviewer only: the project file's Reviewer checklist, word for word>
REQUEST: <councillor only: the user's request, word for word>
BASE: <councillor only: the commit the change is diffed against>
SEAT: <councillor only: 1 to 10>
```

Every implementor, reviewer and councillor handoff carries the `ACCEPTANCE CRITERIA:` block unchanged. The
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
