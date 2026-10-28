---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a four-role subagent pipeline (investigator, implementor, simplifier, reviewer) and a capped fix loop. The main Opus conversation orchestrates; Haiku subagents do the work.
---

# Feature Flow Lite

Four named agents and one loop. The main conversation (Opus) writes the acceptance criteria,
hands the work to Haiku, runs the checks itself, and stops after two fix rounds. In
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
| `implementor` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every run: builds the change, running targeted tests as it goes and the full checks once at the end. One per slice when the change is sliced (step 3). |
| `simplifier` | haiku / medium | Read, Edit, Write, Bash, Grep, Glob | Every task, after the checks pass. Makes the change simpler without changing behavior: splits or inlines helpers it gave a flag or mode parameter, rewrites over-engineered parts the plainer way, removes dead code. Always one, over the whole diff. |
| `reviewer` | haiku / medium | Read, Grep, Glob, Bash | Every run, after the checks pass. Red team: writes and runs probes to break the change. One per slice when the change is sliced. |

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
   **Slices.** Then decide whether to fan out. One Haiku agent loses track of a large change, so
   when the change will touch about six or more files, or two or more areas that can be built
   against a fixed interface (a store or API and the UI that calls it, a library and its CLI,
   several independent components), split it into 2 to 4 slices. Otherwise keep one lane and
   skip every slice instruction below; a small change costs nothing extra. For each slice write:
   - **Owned files**: every file it may create or edit. Each file belongs to exactly one slice,
     new files included. A file several slices need (a shared store, a types module, the docs)
     goes to one owner; the others read it and code against the contract.
   - **Criteria**: which acceptance criteria and hostile inputs it builds and tests.
   - **Contract**: one block, shared by every slice and pasted into each handoff word for word,
     with the exact names, signatures, types, state fields, props and events that cross slice
     boundaries. Write it from the criteria and the investigator's map, specific enough that
     two slices built blind against it fit together.
   If one slice is the foundation the others can't be written without (it adds the functions
   they call), it may run first, alone; the rest then go in one parallel wave. Name the slices
   and their owned files in a line before spawning.
3. **Implementor** with the handoff below. Sliced: one implementor per slice, all spawned in one
   message so they run in parallel, each with the full `ACCEPTANCE CRITERIA:` block plus its
   `SLICE:` and the `CONTRACT:`. Each edits only its owned files; if it needs a change in another
   slice's file, it says so under OPEN QUESTIONS instead of making it. Its targeted tests may
   fail where they call another slice's unfinished code; it codes to the contract and reports
   that rather than stubbing the other slice. Its CHECKS include a targeted test command (the
   test file or package for the code it changes), so it doesn't run the full suite while it
   works. The end-of-work CHECKS are the repo's own full set: the test suite plus every lint,
   format and typecheck the project runs (the project file's Checks), even ones the request
   didn't name.
4. **Checks.** Run that full set yourself, once per round (sliced: once every slice has
   returned). If they fail, send the failing lines back to the implementor; this counts as a fix
   round. Sliced: send each failure to the slice that owns the file it points at, all owners in
   one parallel wave, and settle a contract mismatch yourself first (decide which side is right
   and tell both).
5. **Simplifier**, on every task once the checks pass. Give it the diff and the acceptance
   criteria. Re-run the full checks after it; if it broke something, revert its edits rather
   than spending a fix round on them.
6. **Reviewer** with the same acceptance criteria and hostile inputs. It is a red team: it
   writes and runs probes that try to break each criterion and hostile input, and only
   reproduced failures count as blocking. Pass along the commands it needs to run the project
   (the project file's Run it line) and its Reviewer checklist as `PROJECT CHECKLIST:`.
   Sliced: one reviewer per slice, all spawned in one message. Each gets the full criteria, its
   `SLICE:` (the files and criteria to attack) and the `CONTRACT:`, and attacks its slice plus
   the seams: every place its slice calls, or is called by, another slice. Each reviewer still
   sees the whole diff, so a bug it finds outside its slice counts.
7. **Fix loop.** Blocking findings go back to the implementor, then checks, then an
   incremental review of only the changed hunks plus the reviewer's earlier findings. Sliced:
   each finding goes to the slice that owns the file, all affected owners in one parallel wave,
   and only the slices that changed get a round-2 reviewer, again in one wave. A wave counts as
   one round. Stop
   after two rounds and report what passed, what still fails, and the open findings. Style
   nits are reported, not looped on.
8. **Final read.** Before reporting, read the whole diff yourself against the sibling and the
   hostile inputs, as a maintainer reviewing it would. Anything they'd send back (a missing
   capability, a wrong edge case, a docs sentence the code doesn't back, an edit to an
   unrelated line) goes back to the implementor if a fix round is left; otherwise report it.
9. **Report** the outcome, which agents ran, and the slices if you fanned out.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change; what you already know about them>
CONSTRAINTS: <scope limits, files not to touch, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from step 1, word for word>
CHECKS: <targeted test command while working; full test and lint commands for the end>
PROJECT CHECKLIST: <reviewer only: the project file's Reviewer checklist, word for word>
SLICE: <sliced runs only: the slice's name, its owned files, the criteria it builds or attacks>
CONTRACT: <sliced runs only: the shared contract block, word for word>
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
