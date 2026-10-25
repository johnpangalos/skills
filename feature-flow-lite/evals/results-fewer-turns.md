# Fewer orchestrator turns (v5b): results

Two arms, three builds each, on `pd-corner-nudge` and `pd-belt-side-lift` (12 builds, `-j 2`, one
container). `lite-v4` is the v4 SKILL.md on `claude/feature-flow-lite-v3` at `8a01433`.
`lite-v5-turns` adds the `fewer-turns` variant (`harness/variants/fewer-turns/SKILL.md`) on top
of it. Both arms were re-graded serially on an idle machine. Each remaining outcome failure was
re-run alone and is real. The builds were blind-judged with `judge.workflow.js` (2 judges per
task, owner rubric). Raw numbers: `python3 turns.py results/v4 results/v5` and
`python3 threads.py ...`.

## Summary

- **Main-thread turns fell by about half**: from 15.3 to 10.0 on belt and from 18.0 to 9.0 on
  corner. Main-thread model wait fell from 1.9 to 1.4 min (belt) and from 2.9 to 1.7 min
  (corner). Main-thread cost fell by about a third (belt $0.68 → $0.53, corner $0.88 → $0.57).
- **Wall time didn't move**: belt took 19.7 → 20.6 min and corner 26.5 → 30.9 min. Main-thread
  model wait is only 7–11% of a v4 build's wall time. The rest is Haiku subagents (summed
  subagent time is 18–26 min per build) and test runs. The corner slowdown comes from longer
  implementor runs, not the main thread.
- **The "11.5 min main-thread model wait" figure is mostly subagent time.** `threads.py`'s
  `api_s` is `duration_api_ms` from the result event. That number covers every API call in the
  run, Haiku subagents included (v4 corner rep 2: 820 s of API time against 9k Opus output
  tokens and 131k Haiku output tokens). Measured from per-message timestamps (`turns.py`), the
  v4 main thread waits on the model 1.7–3.6 min per build. Plain Opus has no subagents, so its
  `api_s` really is main-thread time, and the two numbers aren't comparable.
- **Outcomes and judged quality didn't move**: 41/42 outcome checks passed in each arm. Judged
  scores were 6.50 against 6.33 on corner and 5.92 against 6.00 on belt. The judges separated
  builds by approach (whether the nudge checks the cell above the head; how the lift hooks into
  the wall-rider path), and that cut across arms.
- Full-suite runs per build also fell, as a side effect: main 2.2 / sub 2.8 against main 2.3 /
  sub 5.7 for v4. Foreground subagents seem to re-run the suite less, though the subagent
  counts are noisy (1–12).

## Per task and arm (means of 3)

| task | arm | outcome checks | cost $ (main / sub) | wall min | model wait, main thread min | `api_s` min (all threads) | main turns | full-suite runs main / sub | judged |
|---|---|---|---|---|---|---|---|---|---|
| pd-corner-nudge | lite-v4 | 20/21 | 1.10 (0.88 / 0.16) | 26.5 | 2.9 | 18.2 | 18.0 | 2.7 / 4.3 | 6.33 |
| pd-corner-nudge | lite-v5-turns | 21/21 | 0.92 (0.57 / 0.21) | 30.9 | 1.7 | 21.2 | 9.0 | 2.3 / 1.3 | 6.50 |
| pd-belt-side-lift | lite-v4 | 21/21 | 0.81 (0.68 / 0.12) | 19.7 | 1.9 | 12.4 | 15.3 | 2.0 / 7.0 | 6.00 |
| pd-belt-side-lift | lite-v5-turns | 20/21 | 0.70 (0.53 / 0.13) | 20.6 | 1.4 | 12.7 | 10.0 | 2.0 / 4.3 | 5.92 |

Per build:

| task | arm | rep | outcome | cost $ (main / sub) | wall min | main wait min | turns | suite main / sub | judges (blind letter) |
|---|---|---|---|---|---|---|---|---|---|
| corner | lite-v4 | 1 | 6/7 (hidden: a 2px-off rest doesn't enter) | 1.17 (1.01 / 0.15) | 28.8 | 3.4 | 19 | 3 / 2 | 4, 4 (F) |
| corner | lite-v4 | 2 | 7/7 | 0.89 (0.60 / 0.13) | 20.1 | 1.7 | 14 | 2 / 9 | 7, 6.5 (D) |
| corner | lite-v4 | 3 | 7/7 | 1.24 (1.04 / 0.20) | 30.7 | 3.6 | 21 | 3 / 2 | 8, 8.5 (B) |
| corner | lite-v5-turns | 1 | 7/7 | 1.00 (0.50 / 0.22) | 31.2 | 1.4 | 8 | 2 / 1 | 5, 5 (E) |
| corner | lite-v5-turns | 2 | 7/7 | 0.89 (0.53 / 0.21) | 31.5 | 1.5 | 8 | 2 / 1 | 7.5, 8 (C) |
| corner | lite-v5-turns | 3 | 7/7 | 0.87 (0.69 / 0.19) | 30.1 | 2.2 | 11 | 3 / 2 | 7, 6.5 (A) |
| belt | lite-v4 | 1 | 7/7 | 0.79 (0.68 / 0.11) | 15.5 | 2.0 | 17 | 2 / 6 | 5.5, 5 (E) |
| belt | lite-v4 | 2 | 7/7 | 0.84 (0.70 / 0.13) | 20.5 | 1.9 | 16 | 2 / 12 | 6.5, 6.5 (C) |
| belt | lite-v4 | 3 | 7/7 | 0.79 (0.66 / 0.13) | 23.2 | 1.8 | 13 | 2 / 3 | 6.5, 6 (F) |
| belt | lite-v5-turns | 1 | 7/7 | 0.69 (0.53 / 0.15) | 22.1 | 1.5 | 10 | 2 / 4 | 6.5, 6 (A) |
| belt | lite-v5-turns | 2 | 7/7 | 0.68 (0.50 / 0.13) | 19.2 | 1.1 | 9 | 2 / 2 | 5.5, 6 (B) |
| belt | lite-v5-turns | 3 | 6/7 (`vp check`: unused type import in the new test) | 0.73 (0.57 / 0.12) | 20.5 | 1.6 | 11 | 2 / 7 | 6, 5.5 (D) |

Model wait for the main thread is the sum, over its model calls, of the time from the event that
started each call to its last streamed block. A notification's arrival is taken from the
task's `end_time`. The first call has no start event and counts as 0 in both arms.

Process checks: once the grader fix below was applied, the v4 failures were "stages announced
before the first spawn" (6/6 builds) and "main conversation leaves edits to subagents" (2/6).
v5-turns failed "checks before review" once (it made a one-line doc edit itself right before
the incremental review) and "main leaves edits" once.

Both tasks' judges found a defect shared by every build. On belt, a climbing column slower than
the slide cap bobs a grounded player, and that capped all six scores near 6. On corner, the
spread came from whether the nudge confirms there is a real corner (B and C did).

## Where the v4 main thread's turns go

From the six `lite-v4` traces (`python3 turns.py -v results/v4`), mean per build:

| turn kind | turns | model wait s | changes the outcome? |
|---|---|---|---|
| spawn an agent (or SendMessage a fix to one) | 5.0 | 71 | yes: criteria, handoffs and fix lists are written here |
| status text after a background spawn ("The implementor is working…", often a long interim report) | 3.8 | 18 | no |
| full check run | 2.5 | 15 | yes (one per round) |
| reading code or the diff, `git status`, re-running a single check | 3.0 | 14 | no: the investigator and the agents' CHECKS lines already cover it |
| ReadNotifications or another wait turn while the investigator reads | 0.7 | 5 | no |
| editing files itself (2 of 6 builds fixed minors directly, then re-ran the suite) | 0.7 | 7 | rarely, and it breaks the main-doesn't-edit rule |
| final report | 1.0 | 14 | the report itself; v4's run 10–20 lines |

In v4, drafting the criteria while the investigator ran in the background saved nothing. Every
build drafted the criteria in a few seconds of the first turns, then spent one to three turns
waiting, posting status, or reading code itself until the investigator returned.

What `fewer-turns` changed, per build: status turns 3.8 → 0, read/bash turns 3.0 → 0.2, wait
turns 0.7 → 0, edit turns 0.7 → 0.2. Spawn and check turns stayed the same (5.8 and 2.3; v5
ran slightly more fix rounds).

**Per-agent overhead**, which a fourth role would add again. In v4 each background spawn costs
three main turns: the spawn, a status message ending the turn, and the wake-up turn that reads
the result (which doubles as the next step's spawn). A role followed by a full re-check, like
v5's simplifier, adds that plus a check turn. With background spawns that is about 3 turns,
~25 s of Opus wait, the status text's output tokens, and one full suite run (85 s idle, 2–3 min
under load). With foreground spawns it drops to 2 turns (spawn, check) and ~15 s; the suite run
stays. The suite run is the bigger cost, and it is the other experiment's subject.

## The variant

`harness/variants/fewer-turns/SKILL.md` makes these changes to v4's SKILL.md:

- Spawn every agent in the foreground (`run_in_background: false`) and act on its result in
  the turn it returns. In `claude -p` an unset `run_in_background` started all three agents in
  the background (`subagent_stats.started_in_background: 3`), and each background spawn cost a
  status turn and a wake-up turn.
- The investigator runs first in the foreground. The criteria and the implementor handoff are
  one step after it returns, and the stage list goes in the same message as the investigator
  spawn (the trace grader wants stage words before the first spawn; v4 failed that 6/6).
- Don't read or grep the code or the diff yourself; don't re-run a command an agent's CHECKS
  line already reports; don't edit files; no progress messages between steps.
- One full check run per round, in a single Bash call that prints each command's exit status.
- A report in under ten lines.

## Harness changes on this branch

- `turns.py`: per-build main-thread turns (labelled by what each did), main-thread model wait
  from message timestamps, and full-suite runs split between main thread and subagents. `-v`
  lists every turn.
- `grade.py`: `CHECK_COMMAND` now matches `mise run`, `stylua`, `luacheck` and `vp test|check`.
  Before this, "checks pass before any review" failed every playdate build in both arms.
- `scenarios.json`: the `lite-v5-turns` arm.

## Porting to v5

v5 (`2471d28`) has four roles and runs the simplifier and a re-check between the checks and
the reviewer, so it pays the per-agent overhead four times. The same edits apply. Exact
wording for v5's SKILL.md:

In the Roles table, the investigator row's "When" becomes:

> Every task in an existing codebase, first. Maps the code, the conventions, similar code to copy the shape of, shared helpers not to stretch, and docs that contradict the code.

After "No agent can spawn another; the main conversation spawns all of them.":

> Spawn each one in the foreground (`run_in_background: false`) and act on its result in the
> same turn it returns: a background agent costs you a status message and a wake-up turn for
> every spawn.
>
> Every turn of yours is an Opus call on the critical path, so keep them few. Don't read or
> grep the code or the diff yourself: the investigator's report is your map, and the
> implementor, simplifier and reviewer read what they need. Don't re-run a command whose
> result an agent's CHECKS line already reports; your full check runs are the only checks you
> run. Don't edit files yourself, and don't post progress messages between steps.

Flow step 1 becomes:

> 1. **Investigator**, on every task in an existing codebase (skip it only for a new project in
>    an empty repo). In the same message, name the stages you'll run in one line and spawn it
>    with the request.

Flow step 2's heading becomes "**Acceptance criteria and handoff**, in one step when the
investigator returns." Its sentence "look at how a similar feature was added (…) and require
the same" becomes "from the investigator's report of how a similar feature was added (…)". Its
last sentence becomes "Put the investigator's findings in the handoff under FILES and
CONSTRAINTS and spawn the implementor in the same message."

Flow step 4 adds: "…once per round, in one Bash call (chain them with `;` and print each one's
exit status)."

Flow step 5 (simplifier) keeps "Re-run the full checks after it", using the same single Bash
call. The style-nit sentence in the fix loop ends "…reported, not looped on, and not fixed by
you." The report step becomes:

> **Report** in under ten lines: the outcome, the check results, open findings, and which
> agents ran.

Expect about half the main-thread turns and a third off the main-thread cost. Don't expect much
off the wall time: these edits save 1–1.5 min of Opus wait per build. Wall time goes down when
there are fewer full-suite runs and shorter subagent runs.
