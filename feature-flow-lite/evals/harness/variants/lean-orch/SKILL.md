---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a subagent pipeline (investigator, criteria check, implementor, simplifier) and an Opus review gate that red-teams the change and decides when it is mergeable. The main Opus conversation orchestrates; Haiku subagents do the building.
---

# Feature Flow Lite

Five named agents, a review panel and one loop. The main conversation (Opus) writes the
acceptance criteria while the investigator maps the code, has them checked against the request before anything is built,
hands the work to Haiku and runs the checks itself. It never decides on its own that the work is
done: a fresh gatekeeper, a maintainer who didn't build it, red-teams the change and decides
whether it is mergeable, and the work goes back until it says yes. In the evals
(`evals/README.md`, sections 12 to 18) this panel was the first setup to pass every hidden test
on a Go middleware task and a react-aria shadow DOM change, and the audit found no must-fix in
6 of 7 builds. It costs 3 to 4 times the Haiku-reviewer version ($5 to $9 a build against about
$1.35) and took 19 to 37 minutes. Every role runs on every
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
| `gatekeeper` | opus / high | Read, Grep, Glob, Bash | Every run, after the checks pass: three at once, each with its own focus, then one fresh on the final diff. Each red-teams the change (probes for every criterion and hostile input, the project checklist) and decides, as a maintainer who didn't build it, whether it is mergeable; continued, it verifies the fixes for its own must-fixes. |

No agent can spawn another; the main conversation spawns all of them.

The plugin also ships a mod in `hooks/` that starts once this skill is invoked. It puts the
latest `ACCEPTANCE CRITERIA:` block back into any implementor, criteria-checker or gatekeeper handoff that drops it,
adds a note to the result when an implementor run leaves no changed test file in the repo, and
records per-role tokens and time, which `/ff-usage` prints. It never blocks a spawn or a tool call.
With `FEATURE_FLOW_CHECK_CACHE=1` it also replays a passing check on an unchanged tree instead of
running it again (`hooks/check-cache.ts`).

## Keep the main thread lean

The main conversation is the most expensive seat: every word it writes is Opus output, and
everything it reads is re-read on every later turn. So:
- **Brief files.** At step 2, write the acceptance criteria with their hostile inputs to
  `criteria.md`, and the user's request word for word, the base commit, the CHECKS, the
  sibling's path, the project file's Run it line and its Reviewer checklist to `brief.md`, both
  in your scratchpad directory (a `mktemp -d` outside the repo if you have none). Don't also
  write them out in chat. When a criterion changes, edit `criteria.md`.
- **Handoffs point at the files.** In every handoff `ACCEPTANCE CRITERIA:` is one line,
  `read <absolute path>/criteria.md (the full list with hostile inputs)`, and
  `BRIEF: <absolute path>/brief.md` stands in for REQUEST, BASE, CHECKS, SIBLING and PROJECT
  CHECKLIST. Write only what is specific to that agent: its GOAL, FILES, CONSTRAINTS, FOCUS, the
  must-fixes. If an agent says it couldn't read a file, paste that file's text into its next
  handoff.
- **Checks go to a log.** Run checks with their output sent to a log file in the scratchpad, and
  read only the exit codes and the failing lines (`grep`, `tail -40`). Don't read diffs, whole
  test logs or source files the agents already read into the main thread; the agents read the
  tree themselves.
- **Few turns, few words.** Put independent tool calls in one message (the three panel spawns,
  the checks beside a spawn). Between tool calls write at most one short line, and don't restate
  what an agent returned.
- **Fix handoffs and verify messages.** One line per must-fix with its repro command, copied
  from the gatekeeper. When you continue a verifier, say which of its must-fixes the fix
  addressed and which files it touched; it reads the diff itself.

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
   empty repo.) In the same message, start the project's full checks on the untouched tree with
   Bash `run_in_background` (the project file's Checks if it exists, else the CI's or the
   package scripts'), so you know which checks already fail at the base commit without
   rerunning them later. Don't wait for either: go on with steps 1 and 2 while they work.
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
   Name the sibling's path in FILES. **The request wins over the sibling.** Where the request's
   words and the sibling's behavior disagree (the request says the new code buffers, holds,
   rejects or always does something, and the sibling streams, forwards or allows it), the
   criterion follows the request, not the sibling.

   **Hostile inputs.** Under each criterion that takes input, list two or three inputs a careless
   build gets wrong (malformed list members, empty, huge or zero values, values past the
   integer range, an interrupt mid-run, output that fails to write, a value that matches a
   reserved word, a case where the right answer can't be computed, where omitting beats
   emitting something wrong). They go to the implementor as cases to test and to
   the gatekeeper as cases to reproduce.
3. **Fold in the investigator.** Wait for it if it hasn't returned. Add any convention, sibling
   behavior or place the sibling appears that it found to the criteria, and its files and
   constraints to the implementor's FILES and CONSTRAINTS.
4. **Criteria check.** Spawn a fresh `criteria-checker` with the `BRIEF:` and
   `ACCEPTANCE CRITERIA:` lines (the brief holds the request word for word and the sibling's path). It flags every criterion that contradicts the request, drops something it
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
6. **Checks.** Run that full set yourself after the implementor's first build. If they fail,
   send the failing lines back to the implementor. A failure that also failed at the base
   commit (step 0) is pre-existing: note it, don't fix it. After later fix rounds, run only the
   checks for the packages the diff touches; the full set runs once more beside the final gate.
7. **Simplifier**, on every task once the checks pass. Give it the diff and the acceptance
   criteria. Re-run the full checks after it; if it broke something, revert its edits rather
   than spending a fix round on them.
8. **Review panel.** Spawn **three** gatekeepers **in one message** so they run in parallel, each
   with the `BRIEF:` and `ACCEPTANCE CRITERIA:` lines, the latest checks result in one line, and its
   own `FOCUS:`:
   - **request**: every sentence of the request and every criterion, probed in the request's
     own words; wrong or missing criteria.
   - **edges**: what the new code wraps or stands in for and every capability and edge input it
     has (empty, huge, malformed, repeated, concurrent, interrupted, the optional interfaces).
     Where the new code wraps something, it compares the two: the same inputs run with and
     without the wrapper, across call orders (state changed before and after the first write
     or commit, flush, hijack or close, trailers, a second call), with every output diffed.
   - **repo**: conventions, the sibling and the places it appears, docs, changelog and help text
     against the code, tests for every new behavior, unrelated edits, the full checks.
   Each lists every must-fix it can reproduce in its focus, not just the first. Start the panel
   as soon as the simplifier's edits pass the targeted checks; run the full checks in the
   background at the same time, and if they fail, send that to the implementor and discard the
   panel's round. Merge the panel's must-fixes, dropping duplicates.
9. **Fix and verify.** Send all the must-fixes to the implementor in one handoff, with this
   constraint: change only what each must-fix needs; any other change in behavior is a
   regression, even one that looks like an improvement. Then run the affected checks. Then **continue** each gatekeeper that raised a must-fix (SendMessage to its
   agent, don't spawn a new one) with the fix diff: it reruns the probes behind its must-fixes
   and checks the changed hunks for regressions. Loop fix and verify until every panel member
   says `MERGEABLE: yes`. A verifier raises new must-fixes only for regressions and for what the
   fix touched.
10. **Final gate.** Spawn one **fresh** gatekeeper, `FOCUS: all`, on the whole final diff, with the
   full checks running beside it and a `RULED ON:` list of everything the panel raised and how
   it was settled. If it says no, fix its must-fixes, then continue that same gatekeeper to
   verify (same constraint: only what its must-fixes need). The work is done only when this
   final gatekeeper says `MERGEABLE: yes`. There is no
   round cap. Nits are reported, not looped on.
   - **Criteria.** A wrong criterion a gatekeeper confirms means your criteria were wrong:
     rewrite it (and its hostile inputs), and send the corrected list with the fix. Every later
     handoff carries the corrected list.
   - **Overruling.** If a must-fix is wrong (it contradicts the request, or the gatekeeper
     misread the code), you may overrule it, but only by showing why (quote the request or
     run the command that disproves it) and listing it under "Overruled" in the report. Add
     what you overruled to `RULED ON:`.
   - **Thrashing.** If a fix breaks the checks, or a must-fix comes back after it was fixed,
     revert that round's edits and send the implementor a narrower handoff instead of stacking
     fixes.
   - **Only the user can decide.** If a must-fix needs the user (the request contradicts itself,
     or the fix needs a file that's off-limits), stop and report the change as not mergeable,
     with the question.
11. **Report.** At most 15 lines. The first line is `Mergeable: yes` (the final gatekeeper said so on the final
   diff) or `Not mergeable:` and why. Then, a line or two each: what changed, which agents ran, what the criteria
   check changed, how many panel, verify and final-gate rounds it took, the gatekeeper's DECISIONS, anything overruled,
   and every open nit. Never call the work done, finished or ready while anything you know of is
   open; list it instead.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA: read <absolute path>/criteria.md (the full list with hostile inputs)
BRIEF: <absolute path>/brief.md (the REQUEST word for word, BASE, CHECKS, SIBLING, Run it, PROJECT CHECKLIST)
CHECKS: <implementor only: the targeted test command while working; the full set is in the brief>
FOCUS: <gatekeeper only: request, edges, repo, or all>
RULED ON: <final gatekeeper only: what the panel raised and how each was settled, one line each>
```

Every criteria-checker, implementor and gatekeeper handoff carries the `ACCEPTANCE CRITERIA:` line and the `BRIEF:` line. The
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
