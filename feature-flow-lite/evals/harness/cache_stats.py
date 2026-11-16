"""Speed of each run, and what the mod's check cache (FEATURE_FLOW_CHECK_CACHE=1) did.

    python3 cache_stats.py results/<batch> [results/<batch> ...]

Per run: wall time, cost, gatekeeper rounds, whether the criteria check flagged a
criterion, and from the workspace's .git/ff-check-cache/ledger.tsv the cache's hits,
misses, the check time it saved (the stored run's duration, per hit) and time spent
waiting on another agent's run of the same check. Needs the workspaces in /tmp.
"""
import json
import pathlib
import re
import subprocess
import sys

import grade


def ledger(workspace):
    try:
        common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=workspace,
                                capture_output=True, text=True, check=True).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError, NotADirectoryError):
        return None
    path = pathlib.Path(common) / "ff-check-cache" / "ledger.tsv"
    if not path.exists():
        return None
    rows = []
    for line in path.read_text().splitlines():
        f = line.split("\t")
        if len(f) >= 7:
            rows.append({"event": f[1], "key": f[2], "seconds": float(f[5] or 0), "waited": float(f[6] or 0),
                         "origin": f[7] if len(f) > 7 else ""})
    return rows


def criteria_flags(t):
    """[wrong]/[missing] findings the criteria checker returned, by spawn."""
    out = []
    for s in t.of_role("criteria_check"):
        out.append(len(re.findall(r"\[(?:wrong|missing)\]", t.returned_text(s) or "")))
    return out


def main(batches):
    print(f"{'scenario':<16} {'arm':<24} {'wall':>6} {'cost':>6} {'gates':>5} {'crit':>5} {'hits':>4} {'miss':>4} {'saved':>6} {'waited':>6}")
    for batch in batches:
        for meta_path in sorted(pathlib.Path(batch).glob("*/*/rep-*/meta.json")):
            meta = json.loads(meta_path.read_text())
            run = meta_path.parent
            t = grade.Trace(grade.load_trace(run / "trace.jsonl"))
            cost = (t.result or {}).get("total_cost_usd") or 0
            gates = len(t.of_role("gate"))
            crit = criteria_flags(t)
            rows = ledger(meta["workspace"])
            # A hit by the mod's own check-ahead run saved nobody time: count agents' hits only.
            hits = [r for r in rows or [] if r["event"] == "hit" and not r["origin"].startswith("mod")]
            misses = [r for r in rows or [] if r["event"] != "hit"]
            saved = sum(r["seconds"] for r in hits)
            waited = sum(r["waited"] for r in rows or [])
            cache = (f"{len(hits):>4} {len(misses):>4} {saved/60:>5.1f}m {waited/60:>5.1f}m" if rows is not None else f"{'-':>4} {'-':>4} {'-':>6} {'-':>6}")
            print(f"{meta['scenario']:<16} {meta['arm']:<24} {meta['wall_s']/60:>5.1f}m {cost:>6.2f} {gates:>5} {','.join(map(str, crit)) or '-':>5} {cache}")
            for r in hits:
                print(f"{'':<16}   hit  {r['key'][:60]:<60} saved {r['seconds']:.0f}s" + (f", waited {r['waited']:.0f}s" if r["waited"] >= 1 else ""))


if __name__ == "__main__":
    main(sys.argv[1:])
