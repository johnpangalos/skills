"""Turn graded builds into D1 inserts for the `runs` table (see schema.sql).

    python3 to_sql.py <suite> <data dir> [<data dir> ...] > rows.sql

Each data dir holds <scenario>/<arm>/rep-N/{grading,audit,meta}.json, as the
suite-*-data/slice-N folders do. Rows are upserts, so reloading is safe.
"""
import ast, collections, glob, json, os, sys

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(round(v, 4)) if isinstance(v, float) else str(v)
    return "'" + str(v).replace("'", "''") + "'"

suite, dirs = sys.argv[1], sys.argv[2:]
print(f"INSERT OR IGNORE INTO suites (suite) VALUES ({q(suite)});")
for root in dirs:
    for g in sorted(glob.glob(f"{root}/*/*/rep-*/grading.json")):
        d = os.path.dirname(g)
        scen, arm, rep = d.split("/")[-3], d.split("/")[-2], int(d.rsplit("-", 1)[1])
        G = json.load(open(g)); m = G["metrics"]
        out = [e for e in G["expectations"] if e["text"].startswith("[outcome]")]
        proc = [e for e in G["expectations"] if e["text"].startswith("[process]")]
        meta = json.load(open(f"{d}/meta.json"))
        merge = nmf = None
        if os.path.exists(f"{d}/audit.json"):
            v = json.load(open(f"{d}/audit.json")).get("verdict")
            v = v if isinstance(v, dict) else ast.literal_eval(v)
            merge, nmf = bool(v.get("mergeable")), len(v.get("must_fix", []))
        roles = collections.Counter(s.split(":")[0] for s in m.get("spawns", []))
        row = dict(
            suite=suite, scenario=scen, arm=arm, rep=rep, batch=os.path.basename(root),
            outcome_pass=all(e["passed"] for e in out),
            outcome_failed=json.dumps([e["text"][10:] for e in out if not e["passed"]]),
            process_pass_rate=(sum(e["passed"] for e in proc) / len(proc)) if proc else None,
            audit_mergeable=merge, audit_must_fix=nmf, cost_usd=m.get("cost_usd"),
            wall_s=meta.get("wall_s") or m.get("duration_s"), roles=json.dumps(dict(roles)),
            rerun=any(k in meta for k in ("rerun_note", "retry_of_original_rep", "note")),
            r2_prefix=f"evals/{suite}/{scen}/{arm}/rep-{rep}/",
        )
        cols = ", ".join(row)
        print(f"INSERT OR REPLACE INTO runs ({cols}) VALUES ({', '.join(q(v) for v in row.values())});")
