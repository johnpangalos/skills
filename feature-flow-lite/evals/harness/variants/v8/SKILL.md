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
| `reviewer` | haiku / medium | Read, Grep, Glob, Bash | Every run, after the checks pass. Red team: writes and runs probes to break the change. For auth, payments, migrations or concurrency, pass `model: opus` and `effort: medium` on the call. |

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
   format and typecheck the project runs (its CI workflow, package scripts, Makefile), even
   ones the request didn't name.
4. **Checks.** Run that full set yourself, once per round. If they
   fail, send the failing lines back to the implementor; this counts as a fix round.
5. **Simplifier**, only for a large diff; re-run the checks after it.
6. **Reviewers**: spawn three red-team reviewers in parallel, in one message, each with the
   same acceptance criteria and hostile inputs and one `FOCUS:` line:
   - `FOCUS: smoke`: use it the way its user would, first. Load every page (with and without
     JavaScript, at desktop and phone widths, and look at the screenshots), run the CLI or
     server through its main flows, or render the components in a real consumer, then check
     every acceptance criterion end to end. Something visibly broken or a headline feature that
     doesn't work outranks any edge case.
   - `FOCUS: composition`: the pieces used together and over time: nesting, two instances at
     once, props or data changing while in use, controlled vs uncontrolled, repeated and
     out-of-order calls, interaction with the code around it.
   - `FOCUS: hostile`: the hostile inputs and anything past them (empty, huge, malformed,
     unicode, interrupted, concurrent), plus docs and help that the code doesn't back.
   Each writes and runs probes that try to break the change; only reproduced failures count as
   blocking. Use a real browser for pages (Playwright or headless Chromium if installed), not a
   DOM stub. Pass along the commands they need to run the project (test runner, server
   start, page render). Merge their findings and drop duplicates.

   **Triage** the merged findings yourself before any fix round. Keep [blocking] only for a
   failing acceptance criterion, a bug a normal user would hit in ordinary use, or a security
   hole. Demote to [minor] anything that needs an exotic input (zero-width characters, CSS
   escapes, contrived navigation sequences), anything about the build's own tests or helper
   scripts rather than the product, and anything a maintainer would merge as is. Only what
   survives triage starts a fix round.
7. **Fix loop.** Blocking findings that survive triage go back to the implementor as targeted
   fixes (edit the lines involved; don't rewrite files), then checks, then all three
   reviewers again in parallel, each with its `FOCUS:`, the changed hunks, and all earlier
   findings: each re-runs the probes behind earlier blocking findings, checks that the fixes
   didn't break what worked, and attacks the change again from its angle; triage again.
   Stop after two fix rounds (three review passes in all) and report what
   passed, what still fails, and the open findings. Style nits are reported, not looped on.
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
