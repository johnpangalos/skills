# Round 8a: one full-suite run per round

Can feature-flow-lite v4 get faster if only the orchestrator runs the full test suite? Round 7 measured v4 builds running the playtest suite (`mise run //playtests:test`, about 50 s idle and 2–3 min under load) 6.6 times per build, with 3.7 of those runs in subagents.

The variant is `harness/variants/one-suite/`, run as the `lite-v5-onesuite` arm. It lays three files over the v4 skill:

- `SKILL.md`: the implementor's CHECKS are the exact targeted commands (one test file or package, plus fast checks such as unit specs and lint). The full suite is named in no agent's handoff. The orchestrator's single full run per round is the only one, and it gates review. The reviewer gets that run's result.
- `agents/implementor.md`: run only the targeted tests and fast checks, never the whole suite, not even at the end.
- `agents/reviewer.md`: never run the full suite, not even to confirm. Run your own probes and the tests that cover the change. The checklist item "the existing test suite still passes" now reads "the orchestrator's suite run passed".

`harness/suite_runs.py` counts full-suite runs per build from the traces, split into the main thread and subagents. A full run is a Bash command matching `//playtests:test|vp test run|vitest run` with no file or name filter after it.

## Setup

Arms `lite-v4` (the working tree of `claude/feature-flow-lite-v3`) and `lite-v5-onesuite`. Tasks `pd-corner-nudge` and `pd-belt-side-lift`, 3 builds each, so 12 builds in total. All 12 ran in batch `results/r8-onesuite` at `-j 2` on one 4-core container, with Opus at medium effort as the main model. Each scenario ran its v4 builds before its variant builds, so the arms did not run side by side. After the batch I re-graded serially on an idle machine. Two judges per task scored the builds blind, using the owner rubric from round 7. The judged score below is the mean of those two judges.

## Results

| task | arm | rep | outcome | cost $ (main / sub) | wall min | model min | subagent min | full suites (main / sub) | spawns | judged |
|---|---|---|---|---|---|---|---|---|---|---|
| corner-nudge | v4 | 1 | 7/7 | 1.51 (1.13 / 0.22)* | 36.4 | 24.8 | 28.7 | 2 / 2 | I R I R | 7.25 |
| corner-nudge | v4 | 2 | 7/7 | 1.13 (0.86 / 0.18)* | 23.3 | 19.4 | 19.3 | 2 / 1 | I R I R | 3.0 |
| corner-nudge | v4 | 3 | 7/7 | 1.08 (0.81 / 0.20)* | 26.6 | 20.5 | 23.0 | 2 / 4 | I R I R | 6.25 |
| corner-nudge | one-suite | 1 | 7/7 | 0.77 (0.65 / 0.10) | 13.4 | 11.4 | 10.0 | 1 / 0 | I R | 5.5 |
| corner-nudge | one-suite | 2 | 7/7 | 0.80 (0.70 / 0.10) | 14.2 | 11.9 | 10.6 | 2 / 0 | I R I | 5.0 |
| corner-nudge | one-suite | 3 | 7/7 | 2.14 (1.57 / 0.24)* | 32.5 | 26.0 | 25.8 | 3 / 0 | I I R I R | 4.5 |
| belt-side-lift | v4 | 1 | 7/7 | 0.91 (0.79 / 0.12) | 16.4 | 12.3 | 12.8 | 2 / 2 | I R I R | 7.75 |
| belt-side-lift | v4 | 2 | 7/7 | 0.85 (0.69 / 0.16) | 20.4 | 15.1 | 16.3 | 2 / 2 | I R I R | 7.5 |
| belt-side-lift | v4 | 3 | 7/7 | 0.78 (0.63 / 0.15) | 19.7 | 13.7 | 16.2 | 2 / 3 | I R I R | 7.25 |
| belt-side-lift | one-suite | 1 | 7/7 | 0.97 (0.84 / 0.13) | 17.3 | 13.8 | 12.6 | 2 / 0 | I R I R | 4.0 |
| belt-side-lift | one-suite | 2 | 7/7 | 0.77 (0.69 / 0.08) | 11.5 | 9.0 | 7.7 | 3 / 0 | I R | 6.5 |
| belt-side-lift | one-suite | 3 | 7/7 | 1.17 (0.88 / 0.12) | 13.6 | 10.8 | 9.2 | 3 / 0 | I R | 8.0 |

Notes on the columns:

- Outcome counts the 7 outcome checks: hidden playtests, unit specs, the playtest suite, luacheck, stylua, TS checks and "a playtest was added".
- In the cost column, `*` marks a row where main plus sub falls short of the reported total. `threads.py` attributes that remainder to neither thread.
- Model min is `duration_api_ms`, which sums model time across all threads. Subagent min is summed subagent time.
- Spawns lists the agents after the first, investigator, spawn: I = implementor, R = reviewer. In belt v4 rep 1 the orchestrator also spawned the investigator twice.

Means per arm:

| task | arm | cost $ | wall min | model min | full suites main / sub / total | review rounds | judged |
|---|---|---|---|---|---|---|---|
| corner-nudge | v4 | 1.24 | 28.8 | 21.5 | 2.0 / 2.3 / 4.3 | 2.0 | 5.50 |
| corner-nudge | one-suite | 1.24 | 20.1 | 16.4 | 2.0 / 0 / 2.0 | 1.3 | 5.00 |
| belt-side-lift | v4 | 0.84 | 18.8 | 13.7 | 2.0 / 2.3 / 4.3 | 2.0 | 7.50 |
| belt-side-lift | one-suite | 0.97 | 14.1 | 11.2 | 2.7 / 0 / 2.7 | 1.3 | 6.17 |

## Findings

- **Subagents stopped running the full suite.** They ran it 0 times in 6 builds, against 2.3 times per build for v4. I checked every subagent test command in the variant's traces. Implementors and reviewers ran targeted files, such as `vp test run tests/corner-nudge.test.ts tests/jumping.test.ts`, and throwaway probe tests. The orchestrator's own runs stayed at about 2 per build: one per round, plus one more where a fix round followed. Total full-suite runs fell from 4.3 to 2.0–2.7 per build.
- **Wall time fell by about a quarter on both tasks**: 28.8 to 20.1 min on corner-nudge, and 18.8 to 14.1 min on belt-side-lift. Model time fell less (21.5 to 16.4, and 13.7 to 11.2 min). Summed subagent time fell the most (23.6 to 15.5, and 15.1 to 9.8 min).
- Part of the speed-up comes from fewer review rounds, not just shorter ones. All 6 v4 builds ran two implementor/reviewer rounds. Three of the 6 variant builds stopped after one, and a 2 × 3 sample can't separate the two causes. One outlier (corner rep 3, 32.5 min, $2.14) went through three implementor passes after its first full run failed.
- **Cost didn't move.** It stayed at $1.24 on corner-nudge and went from $0.84 to $0.97 on belt-side-lift. Subagent cost fell a little, but the main thread costs about 80% of each build.
- **Outcome checks didn't move**: 12 of 12 builds passed all 7 after the serial re-grade.
- **Judged quality fell**: 5.50 to 5.00 on corner-nudge, and 7.50 to 6.17 on belt-side-lift. Most of the drop is one belt build (one-suite rep 1, 4.0). Its lift is gated on `velocityX ~= 0`, so a player standing still against the belt is never lifted. That is the case the task names, and the hidden tests don't cover it. The best belt build was also a variant build (rep 3, 8.0). On corner-nudge, only one build (v4 rep 1) finished the frame's rise after the nudge, and the others hang under the pipe mouth when the jump has leftover drift. The worst corner build was a v4 build (rep 2, 3.0, a device crash on every head bonk). With 3 builds per cell and judge spreads up to ±0.5, the quality gap is within noise. It doesn't favor the variant, though, and with fewer second review rounds the variant has less chance to catch a missed case.
- Process checks failed about equally in both arms. "Stages announced before the first spawn" and "checks pass before any review" failed in nearly every build of both arms, so they don't separate the arms. In two variant corner builds, the final report named only the reviewer.

**Verdict:** the change does what it was meant to do. Subagent full-suite runs go to zero and builds run about 25% faster, with no change in cost or outcome checks. The judged scores are a little lower, mostly from one bad build, and n=3 can't settle whether that is noise. It is worth porting into v5. Check judged quality again at larger n, and watch whether the reviewer still asks for a second round as often as v4's did.

## Porting to v5

v5 adds the simplifier between the checks and the reviewer. With one suite run per round, the order becomes implementor → simplifier → the orchestrator's single full run → reviewer. That one run then tests the simplifier's edits along with the implementor's, and replaces v3's two runs (one after the implementor, one after the simplifier). Exact wording, file by file (the implementor and reviewer changes are the same as in `variants/one-suite/`):

**SKILL.md, roles table**

- implementor: "Every run: builds the plain version of the change, running only targeted tests and fast checks, then strips its own leftovers. Never the full suite."
- simplifier: append "Runs only the tests covering what it touched. Never the full suite."
- reviewer: "Every task, after a passing check run. Works through its checklist, including simplicity, with its own probes and the tests covering the change. Never the full suite."

**SKILL.md, flow** (replacing v3's steps 3–6)

```
3. **Implementor** with the handoff below. Its CHECKS are the exact targeted commands: the
   test file or package for the code it changes (`vitest run tests/<file>.test.ts`, not the
   task that runs the whole suite), plus fast checks such as unit specs and lint. The full
   suite is yours, so name it nowhere in an agent's handoff.
4. **Simplifier**, on every task once the implementor passes its CHECKS. Give it the diff, the
   acceptance criteria and the same CHECKS.
5. **Checks.** Run the project's full test suite and linters yourself, once per round, after
   the simplifier. This is the only full run in the round and the gate for review. If it
   fails, revert the simplifier's edits and run it once more: a pass means the simplifier broke
   it, so go on to review without its edits; a second failure goes back to the implementor
   with the failing lines and test files, and counts as a fix round.
6. **Reviewer** with the same acceptance criteria, your full-suite result, and the same
   targeted CHECKS. It works through its checklist and reproduces edge cases.
```

In the fix loop, a round is implementor → checks → incremental review. As in v3, the simplifier runs only in the first round.

**Handoff template**: `CHECKS: <exact targeted test commands and fast checks; never the full suite>`

**agents/implementor.md**: replace "While you work, run only the tests that cover what you changed (the test file or package you touched), not the whole suite." with "Run only the tests that cover what you changed (the test file or package you touched) and the fast checks in CHECKS, never the whole suite, not even at the end: the orchestrator runs it once per round and sends you any failures." Drop "the orchestrator re-runs the full checks before review" from the last sentence.

**agents/simplifier.md**: replace "After editing, run the tests that cover what you touched (the test file or package, not the whole suite) and undo any edit that breaks them." with "After editing, run the tests that cover what you touched (the targeted commands in CHECKS, or the test file for the code you changed) and undo any edit that breaks them. Never run the whole suite: the orchestrator runs it once after you."

**agents/reviewer.md**: replace "The orchestrator has already run the full suite and linters; don't re-run them. Run the tests that cover the change and your own probes." with "The orchestrator has already run the full suite and linters and gives you the result; never run the full suite yourself, not even to confirm. Run your own probes and the tests that cover the change (the targeted commands in CHECKS, or the test files for the code the diff touches)." In the checklist, "the existing test suite still passes" becomes "the orchestrator's suite run passed".

## Raw data

`results/` is not committed. On the container that ran this round, the batch is in `harness/results/r8-onesuite/`. It holds the traces, diffs, gradings, `blind-mapping.json` and `judging.json`, which contains the full inspector and judge reports.
