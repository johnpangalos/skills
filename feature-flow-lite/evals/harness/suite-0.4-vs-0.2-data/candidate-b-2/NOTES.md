# candidate-b-2: ui-lib × lite-candidate-b (candidate-0.5b), n=3, -j 2

Batch: `results/20261117-164032` (worker 2). Fixture: pnpm store warmed once by hand with the scenario's `setup`.
There were no setup failures, no reruns, no timeouts and no budget caps hit.

Per-case hidden counts come from re-running `hidden/ui-lib/run_hidden.sh` in each workspace (`hidden_per_case.txt`); `hidden_cases.py` shows "(import)" for vitest.

| rep | blind | hidden cases | outcome checks | answer key | audit | cost $ | wall min |
|---|---|---|---|---|---|---|---|
| 1 | C | 15/15 | 4/4 | 4/5 (trap-hidden-content) | 1 must-fix (docs) | 1.868 | 21.4 |
| 2 | B | 15/15 | 4/4 | 5/5 | 1 must-fix (bug) | 2.011 | 24.5 |
| 3 | A | 14/15 (Combobox arrow keys / aria-activedescendant) | 3/4 | 4/5 (trap-hidden-content) | 1 must-fix (bug) | 1.739 | 19.2 |

Every build made 3 implementor calls (build + 2 fix rounds). Every implementor and reviewer handoff carried TRIGGERED CHECKS with the same three items copied word for word from references/checks.md (Focus and keyboard; Active and selected items in a changing list; Nesting and composition). The simplifier never gets them. In rep 1 the first implementor and first reviewer handoffs added a paragraph of extra notes under the TRIGGERED CHECKS heading. Reviewer findings by build are in `reviewer-findings.txt`.
