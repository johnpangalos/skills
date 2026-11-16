# Blind judging for the 0.4 vs 0.2 suite

1. `fetch_blind.sh <branch>:<tarball path> ...` puts each task's anonymized builds under `/tmp/ffj/tasks/<task>/`.
2. rac-shadow-hide only: build a pristine tree once with `mkdir -p /tmp/ffj/rac-base && cd /tmp/ffj/rac-base && bash <repo>/feature-flow-lite/evals/harness/fixtures/setup_react_spectrum.sh b8f8d1d1842ce55063ca67ab3fef7fe172bc3b83`. Inspectors apply each build's diff to a copy of it.
3. `python3 make_args.py /tmp/ffj/tasks <task> ... > args.json`, then run `harness/judge.workflow.js` as a workflow with those args. That's 2 judges per task.
4. Save the workflow's return value as `results-<tasks>.json` here. Unblind it with the `blind-mapping.json` of the slice the task came from (or `remap-<task>.json` for tasks whose letters were reassigned).
