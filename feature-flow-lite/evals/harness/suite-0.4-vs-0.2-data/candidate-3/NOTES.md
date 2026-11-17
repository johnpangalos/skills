# candidate-3: ui-lib × lite-candidate (candidate-0.5), n=5, -j 2

Batch: `results/20261117-122030` (worker 3). Fixture: pnpm store warmed once by hand. The ui-lib setup doesn't call `fixtures/setup_*.sh`.
There were no setup failures, no reruns, no timeouts and no budget caps hit. No probe dir for ui-lib, so `run_probes.py` was skipped and there's no probes.json.

`hidden_cases.py` can't split vitest output into cases, so it shows "(import) ×5". These per-case counts come from re-running `hidden/ui-lib/run_hidden.sh` in each workspace:

| rep | blind | hidden cases | outcome checks | audit | cost $ | wall min |
|---|---|---|---|---|---|---|
| 1 | E | 14/15 (Combobox arrow keys: no aria-activedescendant on open) | 3/4 | 2 must-fix | 1.535 | 20.3 |
| 2 | C | 15/15 | 4/4 | 1 must-fix | 1.892 | 22.5 |
| 3 | A | 15/15 | 4/4 | 1 must-fix | 1.745 | 25.4 |
| 4 | B | 15/15 | 4/4 | merge | 1.617 | 25.4 |
| 5 | D | 15/15 | 4/4 | 2 must-fix (docs) | 1.710 | 20.2 |

TRIGGERED CHECKS appear in every first implementor and every reviewer handoff (Focus and keyboard; Active and selected items in a changing list; Nesting and composition). The simplifier never gets them. Fix-round implementors got them only in rep 4.
