# newarms-3: ui-lib, lite-reviewer-plus vs lite-tests-first

Batch `results/20261117-064814`, from `python3 run.py -s ui-lib -a lite-reviewer-plus,lite-tests-first -n 5 -j 2`, on branch `claude/nice-keller-1oi9rd` at 58da233.

- Every run passed setup on the first try. None timed out or hit its budget cap. Every result_subtype is `success`.
- ui-lib clones no repo, so there was no fixture cache to warm.
- `probes.json` is missing because ui-lib has no probe dir, so `run_probes.py` was skipped.
- `hidden_cases.py` only parses Python unittest output, so for ui-lib (vitest) it reports `(import)` 0/1 for every build. That is not a real failure. The grader's own hidden check reports `Tests 15 passed (15)` for all 10 builds. Rep-2 of lite-reviewer-plus was re-run by hand because an npm notice cut its evidence short.
- `threads.json` is `threads.py`'s stdout. `run.txt` is the batch log.
- `ff-judge-n3.tar.gz` is the blind tree from `prepare_blind.py`. It has no node_modules; run `pnpm install` in each letter's dir before probing.
