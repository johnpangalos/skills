"""Turn final blind-judging results into D1 inserts for `judge_scores` (see schema.sql).

    python3 judge_sql.py <suite> <judge dir> [final|round2] > judge.sql

Reads every final-*.json (judge.workflow.js return values) in <judge dir> and unblinds
each letter with that task's remap-<task>.json. With `round2`, reads round2-*.json and
remap2-<task>.json instead, and stores the rows under pass 'round2'. Also prints a per-task, per-arm table
of mean judge scores to stderr.
"""
import collections, glob, json, os, sys

suite, jdir = sys.argv[1], sys.argv[2]
pss = sys.argv[3] if len(sys.argv) > 3 else "final"
glob_pat, remap_pre = {"round2": ("round2-*.json", "remap2-"), "round3": ("round3-*.json", "remap3-"), "round4": ("round4-*.json", "remap4-"), "round5": ("round5-*.json", "remap5-")}.get(pss, ("final-*.json", "remap-"))
q = lambda v: "NULL" if v is None else (repr(v) if isinstance(v, (int, float)) else "'" + str(v).replace("'", "''") + "'")
rows, means = [], collections.defaultdict(list)
for f in sorted(glob.glob(f"{jdir}/{glob_pat}")):
    for ch in json.load(open(f)):
        if not ch:
            continue
        task = ch["id"]
        remap = json.load(open(f"{jdir}/{remap_pre}{task}.json"))
        insp = {r["letter"]: r.get("overall") for r in ch.get("reports", [])}
        for j, judge in enumerate(ch.get("judges") or [ch["judge"]], 1):
            for r in judge["ranking"]:
                m = remap[r["letter"]]
                rows.append((suite, task, m["arm"], m["rep"], j, pss, r["score"], insp.get(r["letter"])))
                means[(task, m["arm"])].append(r["score"])
print("\n".join(
    "INSERT OR REPLACE INTO judge_scores (suite, scenario, arm, rep, judge, pass, score, inspector_overall) VALUES ("
    + ", ".join(q(v) for v in row) + ");" for row in rows))
arms = sorted({a for _, a in means})
print("task".ljust(20) + "".join(a[-12:].rjust(14) for a in arms), file=sys.stderr)
for t in sorted({t for t, _ in means}):
    print(t.ljust(20) + "".join(f"{sum(means[(t,a)])/len(means[(t,a)]):14.2f}" if means.get((t, a)) else " " * 14 for a in arms), file=sys.stderr)
