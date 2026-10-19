"""Score batches by hidden test case instead of pass/fail per file.

    python3 hidden_cases.py results/<batch> [results/<batch> ...]

For every run it re-runs the scenario's hidden tests verbosely in the run's workspace
(which lives in /tmp until deleted), and reads the trace for the reviewer's model, how
many [blocking] findings reviewers returned, and how many implementor rounds ran. It
prints, per scenario and arm: mean cases passed, builds that passed every case, cost,
and how often each case failed. Per-run detail goes to <batch>/hidden_cases.json.
"""

import json
import os
import pathlib
import re
import subprocess
import sys

import grade

HERE = pathlib.Path(__file__).resolve().parent
CASE = re.compile(r"^(test_\w+) \(([\w.]+)\) \.\.\. (ok|FAIL|ERROR)$", re.M)


def cases(workspace, hidden):
    env = dict(os.environ, PYTHONPATH=str(workspace), PYTHONDONTWRITEBYTECODE="1")
    proc = subprocess.run(
        ["python3", "-m", "unittest", "discover", "-v", "-s", str(hidden), "-t", str(hidden)],
        cwd=workspace, env=env, capture_output=True, text=True, timeout=900,
    )
    # unittest prints "test_x (module.Class.test_x) ... ok"
    found = {f"{cls.split('.')[-2]}.{name}": status == "ok" for name, cls, status in CASE.findall(proc.stderr)}
    return found or {"(import)": False}  # the module didn't import: every case failed


def score(run_dir, scenario):
    meta = json.loads((run_dir / "meta.json").read_text())
    workspace = pathlib.Path(meta["workspace"])
    t = grade.Trace(grade.load_trace(run_dir / "trace.jsonl"))
    reviewers = t.of_role("reviewer")
    blocking = sum(len(re.findall(r"\[blocking\]", t.returned_text(s), re.I)) for s in reviewers)
    diff = (run_dir / "diff.patch").read_text()
    return {
        "run": str(run_dir),
        "cases": cases(workspace, HERE / "hidden" / scenario.get("hidden", scenario["id"])) if workspace.exists() else {},
        "cost_usd": (t.result or {}).get("total_cost_usd"),
        "reviewer_models": [s["family"] for s in reviewers],
        "blocking_findings": blocking,
        "implementor_rounds": len(t.of_role("implementor")),
        "uses_lock": bool(re.search(r"^\+.*\b(R?Lock|Condition|Semaphore)\(", diff, re.M)),
    }


def main():
    config = json.loads((HERE / "scenarios.json").read_text())
    by_id = {s["id"]: s for s in config["scenarios"]}
    rows = {}
    for batch in map(pathlib.Path, sys.argv[1:]):
        runs = []
        for meta_path in sorted(batch.glob("*/*/rep-*/meta.json")):
            meta = json.loads(meta_path.read_text())
            result = score(meta_path.parent, by_id[meta["scenario"]])
            runs.append(result)
            rows.setdefault((meta["scenario"], meta["arm"]), []).append(result)
        (batch / "hidden_cases.json").write_text(json.dumps(runs, indent=2))

    def mean(values):
        values = [v for v in values if v is not None]
        return round(sum(values) / len(values), 2) if values else "-"

    print("| scenario | arm | runs | cases passed | all passed | cost $ | reviewer models | blocking found | impl rounds | lock |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for (sid, arm), runs in sorted(rows.items()):
        scored = [r for r in runs if r["cases"]]
        passed = [sum(r["cases"].values()) for r in scored]
        total = max((len(r["cases"]) for r in scored), default=0)
        models = sorted({m for r in runs for m in r["reviewer_models"]})
        print(
            f"| {sid} | {arm} | {len(runs)} | {mean(passed)}/{total} | {sum(p == total for p in passed)} "
            f"| {mean([r['cost_usd'] for r in runs])} | {', '.join(models) or '-'} "
            f"| {mean([r['blocking_findings'] for r in runs])} | {mean([r['implementor_rounds'] for r in runs])} "
            f"| {sum(r['uses_lock'] for r in runs)}/{len(runs)} |"
        )
    print()
    for (sid, arm), runs in sorted(rows.items()):
        failures = {}
        for r in runs:
            for case, ok in r["cases"].items():
                failures[case] = failures.get(case, 0) + (not ok)
        failed = ", ".join(f"{c} ×{n}" for c, n in sorted(failures.items(), key=lambda kv: -kv[1]) if n)
        print(f"- {sid} / {arm}: {failed or 'no case failed'}")


if __name__ == "__main__":
    main()
