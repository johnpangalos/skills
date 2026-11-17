---
name: feature-flow-lite
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, with a subagent pipeline (investigator, implementor, simplifier, reviewer) that routes changes which wrap something or touch UI behaviour to an Opus review panel that decides when they are mergeable. The main Opus conversation orchestrates; Haiku subagents do the building.
---

# Feature Flow Lite

Six named agents and two paths. The main conversation (Opus) writes the acceptance criteria while
the investigator maps the code, then picks a path for the change and runs every step of it:

- **Default path:** Haiku builds, the main thread runs the checks, a Haiku red-team reviewer
  probes the change, and at most two fix rounds follow.
- **Careful path:** an Opus criteria-checker checks the criteria first, and a panel of Opus
  gatekeepers, maintainers who didn't build it, red-teams the change and decides when it is
  mergeable.

The careful path is for changes whose bugs only show when someone probes the built thing in
depth: wrappers and stand-ins, and UI or DOM behaviour. Everything else takes the default path,
which in the evals matched or beat the panel at half the cost.

## Roles

Each role is a named agent in this skill's `agents/` folder with its model, effort and tools
pinned in frontmatter. Spawn it as `feature-flow-lite:<agent>` and leave `model` and `effort`
off the call so the pins hold. If those agent types aren't listed, use `general-purpose` with the
model below, start the prompt with `ROLE: <role>`, and end it with the result template.

| Agent | Model / effort | Path | When |
|---|---|---|---|
| `investigator` | haiku / low | both | Every task in an existing codebase, started in the background the moment the skill starts. |
| `implementor` | haiku / medium | both | Every run: builds the change, targeted tests as it goes, the full checks once at the end. |
| `simplifier` | haiku / medium | both | Every task, after the checks pass. Simpler without changing behavior. |
| `reviewer` | haiku / medium | default | Every default-path run, after the simplifier. Red team: writes and runs probes to break the change. |
| `criteria-checker` | opus / medium | careful | Every careful-path run, before the implementor. Checks each criterion against the request and the sibling. |
| `gatekeeper` | opus / high | careful | Every careful-path run: a panel of three, then one fresh final gate. Decides whether the change is mergeable. |

No agent can spawn another; the main conversation spawns all of them. The mod in `hooks/` works as
described in the plugin README.

## Keep the main thread lean

- **Brief files.** At step 2, write the acceptance criteria with their hostile inputs to
  `criteria.md`, and the request word for word, the base commit, the CHECKS, the sibling's path,
  the project file's Run it line and its Reviewer checklist to `brief.md`, both in your
  scratchpad directory. When a criterion changes, edit `criteria.md`.
- **Handoffs point at the files.** `ACCEPTANCE CRITERIA:` is one line, `read <path>/criteria.md`,
  and `BRIEF: <path>/brief.md` stands in for REQUEST, BASE, CHECKS, SIBLING and PROJECT CHECKLIST.
- **Checks go to a log.** Read only exit codes and failing lines.
- **Few turns, few words.** Independent tool calls in one message; at most one short line between
  tool calls.

## Project file

Read `FEATURE_FLOW.md` at the repo root at step 1 of every run. If it doesn't exist, write it from
`templates/project-criteria.md` (Checks from the CI workflow, package scripts or Makefile;
Conventions from how the last few similar changes were added), and say in the report that you
wrote it. When a run teaches something the file should have said, add one line and name it in the
report. Never remove a line the user wrote.

## Flow

0. **Start the investigator now**, in the background, with the request word for word, asking for
   the files involved, the closest existing sibling and every place it appears, the conventions,
   and docs that contradict the code. In the same message, start the full checks on the untouched
   tree in the background, so you know what already fails.
1. **Project file.** Read or write it.
2. **Acceptance criteria.** A short list of testable statements, including what the request only
   implies and how requirements combine. Add the project file's standing criteria and conventions.
   **Sibling:** read the closest sibling; every behavior it has that the new code shares a reason
   for becomes a criterion, including every optional interface a wrapped thing can have. The
   request wins over the sibling. **Hostile inputs:** under each criterion that takes input, two or
   three inputs a careless build gets wrong. Fold in the investigator's findings when it returns.
3. **Route.** Pick the path and write it as the first line of your next message:
   `ROUTE: careful: <reason>` or `ROUTE: default: <reason>`.
   - **Careful** when the new code wraps another object at runtime and has to pass its behavior
     through (a response writer, stream, handler or middleware around a handler), when it walks or
     changes the DOM (accessibility utilities, shadow DOM), when it changes UI component behavior
     (focus, keyboard, ARIA, dialogs), or when the user asks for the careful path.
   - **Default** for everything else, including new modules, bug fixes, CLI flags and parameter
     types, API renames and deprecations, websites, and code with shared state, money or auth.
   - There is no third path. A small change still runs every step of its path; if a change is a
     one-liner, see "Not for".

### Default path

4. **Implementor** with the handoff below; its CHECKS include a targeted test command, and the
   end-of-work CHECKS are the repo's full set.
5. **Checks.** Run the full set yourself. Failing lines go back to the implementor and count as a
   fix round. A failure from the base commit is pre-existing: note it, don't fix it.
6. **Simplifier**, once the checks pass. Re-run the checks after it; if it broke something,
   revert its edits.
7. **Reviewer**, with the brief and criteria. Only reproduced failures count as blocking.
8. **Fix loop.** Blocking findings go to the implementor, then checks, then an incremental review
   of the changed hunks and the earlier findings. Stop after two rounds.
9. **Final read.** Read the whole diff yourself against the sibling and the hostile inputs, as a
   maintainer would. Anything they'd send back goes to the implementor if a round is left;
   otherwise report it.

### Careful path

4. **Criteria check.** A fresh `criteria-checker` with the `BRIEF:` and `ACCEPTANCE CRITERIA:`
   lines. Fix every `[wrong]` and `[missing]` finding before the implementor runs; if you keep a
   flagged criterion, quote the request and list it in the report.
5. **Implementor**, as on the default path.
6. **Checks**, as on the default path.
7. **Simplifier**, as on the default path.
8. **Review panel.** Three gatekeepers in one message, each with `FOCUS:` request, edges or repo,
   as their agent file describes. Merge their must-fixes.
9. **One fix round** if any panelist said no: all must-fixes to the implementor in one handoff;
   any other change in behavior is a regression. If all three said yes with no must-fix, skip to
   the report.
10. **Final gate.** One fresh gatekeeper, `FOCUS: all`, with a `RULED ON:` list of every panel
    must-fix and how it was settled. Fix its must-fixes and continue that gatekeeper until it says
    `MERGEABLE: yes`. Overrule a must-fix only with evidence, and list it.

### Both paths

- **Report.** At most 15 lines. The first line is the route, then `Mergeable: yes` (careful path:
  the final gatekeeper said so) or `Done:` (default path: the checks pass and nothing blocking is
  open) or what is still open. Then what changed, which agents ran, and every open finding. Never
  call the work done while anything you know of is open.

## Handoff

```
GOAL: <one or two sentences: what done looks like>
FILES: <paths to read or change>
CONSTRAINTS: <scope limits, files not to touch>
ACCEPTANCE CRITERIA: read <absolute path>/criteria.md (the full list with hostile inputs)
BRIEF: <absolute path>/brief.md
CHECKS: <implementor only: the targeted test command while working>
FOCUS: <gatekeeper only>
RULED ON: <final gatekeeper only>
```

The agents return the result template themselves (STATUS, SUMMARY, FILES TOUCHED, FINDINGS,
CHECKS, OPEN QUESTIONS).

## Not for

One-line fixes (do them directly), questions (answer directly), and codebase-wide audits or
migrations across thousands of files.
