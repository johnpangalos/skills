---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a four-role subagent pipeline (investigator, implementor, simplifier, reviewer) and a capped fix loop. The main Opus conversation orchestrates; Haiku subagents do the work.
---

# Feature Flow Lite

Four named agents and one loop. The main conversation (Opus) writes the acceptance criteria,
hands the work to Haiku through a workflow script that runs the checks and stops after two fix
rounds. In blind-judged benchmarks on features and bug fixes in real repos, this scored above
plain Opus at about the same cost, and took about two and a half times as long. Every role runs on every
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
2. **Run the pipeline as a workflow.** Steps 2 to 7 of the flow (investigator, implementor,
   checks, simplifier, red-team reviewer, and the fix loop capped at two rounds) are a script in
   this skill's folder: `workflow/feature-flow.workflow.js`. Call the Workflow tool with
   `scriptPath` set to that file's absolute path; it's written already, so don't author or load
   anything to run it. Pass `args` as a JSON object (not a string):

   - `goal`, `files`, `constraints`: the handoff's GOAL, FILES (name the sibling's path) and
     CONSTRAINTS, below.
   - `criteria`: the acceptance criteria list from step 1 with its hostile inputs, word for
     word, as one string.
   - `checks_targeted`: the targeted test command; `checks_full`: an array of the full check
     commands (the project file's Checks).
   - `run_it` and `checklist`: the project file's Run it line and Reviewer checklist, word for
     word.
   - `investigate`: false only for a new project in an empty repo.

   The workflow runs in the background; wait for its result and don't touch the repo meanwhile.
   It returns the status, the fix rounds used, which agents ran, the last checks and the last
   review.
3. **Checks.** Run the full checks yourself once on what the workflow left.
4. **Final read.** Before reporting, read the whole diff yourself against the sibling and the
   hostile inputs, as a maintainer reviewing it would. Anything they'd send back (a missing
   capability, a wrong edge case, a docs sentence the code doesn't back, an edit to an
   unrelated line) goes to one `feature-flow-lite:implementor` spawn with the handoff and the
   finding if the workflow used fewer than two rounds (then run the full checks again); otherwise report it.
5. **Report** the outcome and which agents ran.

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
