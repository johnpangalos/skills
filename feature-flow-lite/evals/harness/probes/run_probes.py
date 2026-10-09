"""Score builds with the scripted tiebreaker probes in probes/<scenario>/probe.sh.

    python3 probes/run_probes.py results/<batch> [...]          # workspaces of a batch
    python3 probes/run_probes.py --blind /tmp/ff-judge MAPPING  # anonymized copies + blind-mapping

Prints per-arm probe pass rate per scenario and writes probes.json next to the first input.
The probes encode what the blind judges used to separate builds that all met the spec, so they
are a cheap proxy for iterating; confirm a winner with the full judge.
"""
import collections, concurrent.futures as cf, json, pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent


def probe(scenario, path):
    script = HERE / scenario / "probe.sh"
    if not script.exists():
        return None
    out = subprocess.run([str(script), str(path)], capture_output=True, text=True).stdout.strip()
    frac = out.split()[0] if out else "0/0"
    p, t = (int(x) for x in frac.split("/"))
    return {"pass": p, "total": t, "fails": out.split()[1:]}


def main(argv):
    jobs = []
    if argv[0] == "--blind":
        root, mapping = pathlib.Path(argv[1]), json.load(open(argv[2]))
        for s, letters in mapping.items():
            for L, v in letters.items():
                jobs.append((s, v["arm"], v["rep"], root / s / L))
        out_path = pathlib.Path(argv[2]).with_name("probes.json")
    else:
        for batch in argv:
            for m in sorted(pathlib.Path(batch).glob("*/*/rep-*/meta.json")):
                meta = json.loads(m.read_text())
                jobs.append((meta["scenario"], meta["arm"], meta["rep"], pathlib.Path(meta["workspace"])))
        out_path = pathlib.Path(argv[0]) / "probes.json"
    jobs = [j for j in jobs if (HERE / j[0] / "probe.sh").exists()]
    with cf.ThreadPoolExecutor(4) as ex:
        results = list(ex.map(lambda j: probe(j[0], j[3]), jobs))
    rows = [dict(scenario=s, arm=a, rep=r, path=str(p), **res) for (s, a, r, p), res in zip(jobs, results) if res]
    out_path.write_text(json.dumps(rows, indent=1))
    agg = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        agg[(r["scenario"], r["arm"])][0] += r["pass"]
        agg[(r["scenario"], r["arm"])][1] += r["total"]
    arms = sorted({a for _, a in agg})
    scen = sorted({s for s, _ in agg})
    print("scenario".ljust(18), *[a.rjust(16) for a in arms])
    for s in scen:
        print(s.ljust(18), *[(f"{agg[(s,a)][0]}/{agg[(s,a)][1]}" if (s, a) in agg else "-").rjust(16) for a in arms])
    tot = {a: [sum(agg[(s, a)][i] for s in scen if (s, a) in agg) for i in (0, 1)] for a in arms}
    print("all".ljust(18), *[f"{tot[a][0]/max(tot[a][1],1):.2f}".rjust(16) for a in arms])


if __name__ == "__main__":
    main(sys.argv[1:])
