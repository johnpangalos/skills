"""Audit finished builds the way a maintainer would before merging, and count what's left.

    python3 audit.py results/<batch> [results/<batch> ...] [-a arm,arm] [-j 4]

The question it answers: when a run says it's done, how many problems are still in the change?
For each run it starts a fresh headless Opus session in the run's workspace, gives it the
original request and nothing else (not the arm, the criteria or the run's report), and asks for
every problem a maintainer would make the contributor fix, each one confirmed with a command or
a line and the repo precedent it breaks. The session works read-only: the workspace's
`git status` and diff must be the same afterwards, or the audit is flagged.

Writes audit.json in each run dir and prints, per scenario and arm: builds the auditor would
merge, mean must-fix count, and the must-fix titles.
"""
import argparse
import collections
import concurrent.futures as cf
import hashlib
import json
import os
import pathlib
import re
import subprocess

from run import SCRUB

HERE = pathlib.Path(__file__).resolve().parent

PROMPT = """A contributor has opened a pull request against this repository. The pull request is the uncommitted change in this working tree: see `git status` and `git diff HEAD`, and read any untracked files.

This is the issue it was written for:

<issue>
{request}
</issue>

You maintain this project, and this is the final review before merge. Find every problem you would make the contributor fix before you merge: behavior that is wrong or contradicts the issue, a regression, a failing test, lint, format or type check, a convention this repo follows that the change skips (say where the repo does it), docs, changelog or help text the code doesn't back, missing tests for new behavior, edits unrelated to the issue, leftover files. Run the project's tests and checks, and try the edge cases a careful maintainer would.

Report only problems you have confirmed: reproduce each with a command (quote it and the output that shows the problem), or point to the exact line and the precedent it breaks. A preference or an equally valid alternative is a nit, not a must-fix.

Don't modify any file in the repo. Put scratch files in a directory from `mktemp -d`; if a probe has to live in the repo to run, delete it before you finish. `git status` must end exactly as you found it.

End your answer with one JSON block and nothing after it:

```json
{{"mergeable": true, "must_fix": [{{"title": "...", "kind": "bug|regression|checks|convention|docs|tests|scope|other", "evidence": "..."}}], "nits": ["..."]}}
```"""


def snapshot(ws):
    # intent-to-add first (run.py already did), so status reads the same before and after
    subprocess.run(["git", "add", "-A", "-N", "."], cwd=ws, capture_output=True)
    status = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=ws, capture_output=True, text=True).stdout
    diff = subprocess.run(["git", "diff", "HEAD"], cwd=ws, capture_output=True, text=True).stdout
    return hashlib.sha256((status + diff).encode()).hexdigest()


def audit(run_dir, request, budget, effort):
    meta = json.loads((run_dir / "meta.json").read_text())
    ws = pathlib.Path(meta["workspace"])
    out = run_dir / "audit.json"
    if not ws.exists():
        return run_dir, {"error": f"workspace {ws} is gone"}
    before = snapshot(ws)
    env = {k: v for k, v in os.environ.items() if k not in SCRUB}
    cmd = ["claude", "-p", PROMPT.format(request=request), "--model", "opus", "--effort", effort,
           "--output-format", "json", "--allowedTools", "Bash,Read,Glob,Grep", "--permission-prompts", "none",
           "--max-budget-usd", str(budget), "--no-session-persistence"]
    try:
        proc = subprocess.run(cmd, cwd=ws, env=env, capture_output=True, text=True, timeout=1800)
        result = json.loads(proc.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError) as err:
        return run_dir, {"error": f"audit failed: {err}"}
    text = result.get("result") or ""
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, re.S)
    try:
        verdict = json.loads(blocks[-1]) if blocks else None
    except json.JSONDecodeError:
        verdict = None
    record = {
        "verdict": verdict,
        "cost_usd": round(result.get("total_cost_usd") or 0, 4),
        "workspace_unchanged": snapshot(ws) == before,
        "report": text,
    }
    if verdict is None:
        record["error"] = "no JSON verdict in the audit's answer"
    out.write_text(json.dumps(record, indent=2))
    return run_dir, record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("batches", nargs="+", type=pathlib.Path)
    parser.add_argument("-a", "--arms", help="comma-separated arms to audit (default: all)")
    parser.add_argument("-j", "--jobs", type=int, default=4)
    parser.add_argument("--budget", type=float, default=4)
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--redo", action="store_true", help="re-audit runs that already have audit.json")
    args = parser.parse_args()

    scenarios = {s["id"]: s for s in json.loads((HERE / "scenarios.json").read_text())["scenarios"]}
    arms = set(args.arms.split(",")) if args.arms else None
    jobs = []
    for batch in args.batches:
        for meta_path in sorted(batch.glob("*/*/rep-*/meta.json")):
            meta = json.loads(meta_path.read_text())
            if arms and meta["arm"] not in arms:
                continue
            sc = scenarios[meta["scenario"]]
            request = sc.get("prompt") or scenarios[sc["prompt_from"]]["prompt"]
            jobs.append((meta_path.parent, meta, request))

    todo = [j for j in jobs if args.redo or not (j[0] / "audit.json").exists()]
    with cf.ThreadPoolExecutor(args.jobs) as pool:
        for run_dir, record in pool.map(lambda j: audit(j[0], j[2], args.budget, args.effort), todo):
            v = record.get("verdict") or {}
            print(f"{run_dir}: mergeable={v.get('mergeable')} must_fix={len(v.get('must_fix') or [])} "
                  f"${record.get('cost_usd')} {record.get('error', '')}", flush=True)

    rows = collections.defaultdict(list)
    for run_dir, meta, _ in jobs:
        path = run_dir / "audit.json"
        if path.exists():
            rows[(meta["scenario"], meta["arm"])].append(json.loads(path.read_text()))
    print("\n| scenario | arm | audited | auditor would merge | must-fix per build | audit $ |")
    print("|---|---|---|---|---|---|")
    totals = collections.defaultdict(list)
    for (sid, arm), recs in sorted(rows.items()):
        ok = [r for r in recs if r.get("verdict")]
        merge = sum(bool(r["verdict"].get("mergeable")) for r in ok)
        fixes = [len(r["verdict"].get("must_fix") or []) for r in ok]
        totals[arm] += fixes
        flag = "" if all(r.get("workspace_unchanged", True) for r in recs) else " (workspace changed!)"
        print(f"| {sid} | {arm} | {len(ok)}/{len(recs)} | {merge} | {sum(fixes) / max(len(fixes), 1):.2f} "
              f"| {sum(r.get('cost_usd', 0) for r in recs) / max(len(recs), 1):.2f} |{flag}")
    for arm, fixes in sorted(totals.items()):
        print(f"\n{arm}: {sum(f == 0 for f in fixes)} of {len(fixes)} builds with no must-fix, "
              f"{sum(fixes) / max(len(fixes), 1):.2f} must-fix per build")
    for (sid, arm), recs in sorted(rows.items()):
        for r in recs:
            for f in (r.get("verdict") or {}).get("must_fix") or []:
                print(f"- {sid} / {arm}: [{f.get('kind')}] {f.get('title')}")


if __name__ == "__main__":
    main()
