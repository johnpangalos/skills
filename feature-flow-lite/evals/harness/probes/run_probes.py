"""Score builds with the scripted tiebreaker probes in probes/<scenario>/probe.sh.

    python3 probes/run_probes.py results/<batch> [...]          # workspaces of a batch
    python3 probes/run_probes.py --blind /tmp/ff-judge MAPPING  # anonymized copies + blind-mapping
    python3 probes/run_probes.py --blind /tmp/ffj/final2 judge/remap2-*.json --keys keys-round2.json

Prints per-arm probe pass rate per scenario and writes probes.json next to the first input.
A MAPPING is a blind-mapping.json ({task: {letter: {arm, rep}}}) or a combine.py remap file
(remap-<task>.json / remap2-<task>.json: {letter: {arm, rep, ...}}, task taken from the name).
--keys OUT writes {task: {letter: {arm, rep, failing: [ids]}}} keeping only the probes/keys.json
ids of each task (in blind mode the letters are the pool's letters), plus "error": true when the
probe itself broke, so a broken probe never reads as "no keyed bugs".
The probes encode what the blind judges used to separate builds that all met the spec, so they
are a cheap proxy for iterating; confirm a winner with the full judge.
"""
import collections, concurrent.futures as cf, json, pathlib, re, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent


def probe(scenario, path):
    script = HERE / scenario / "probe.sh"
    if not script.exists():
        return None
    out = subprocess.run([str(script), str(path)], capture_output=True, text=True).stdout.strip()
    frac = out.split()[0] if out else "0/0"
    p, t = (int(x) for x in frac.split("/"))
    return {"pass": p, "total": t, "fails": out.split()[1:]}


ERRORS = {"probe-error", "build-failed"}


def load_mapping(path):
    m = json.load(open(path))
    if m and all(isinstance(v, dict) and "arm" in v for v in m.values()):
        task = re.match(r"remap2?-(.+)\.json$", pathlib.Path(path).name)
        if not task:
            sys.exit(f"{path}: a per-task mapping needs to be named remap-<task>.json or remap2-<task>.json")
        return {task.group(1): m}
    return m


def main(argv):
    jobs, keys_out = [], None
    if "--keys" in argv:
        i = argv.index("--keys")
        keys_out = pathlib.Path(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    if argv[0] == "--blind":
        root = pathlib.Path(argv[1])
        for mp in argv[2:]:
            for s, letters in load_mapping(mp).items():
                for L, v in sorted(letters.items()):
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
    if keys_out:
        answer = json.load(open(HERE / "keys.json"))
        keyed = {}
        for r in rows:
            ids = answer.get(r["scenario"], {})
            e = {"arm": r["arm"], "rep": r["rep"], "failing": sorted(f for f in r["fails"] if f in ids)}
            if ERRORS & set(r["fails"]) or r["total"] == 0:
                e["error"] = True
                print(f"warning: probe error on {r['scenario']} {r['path']}", file=sys.stderr)
            keyed.setdefault(r["scenario"], {})[pathlib.Path(r["path"]).name] = e
        keys_out.write_text(json.dumps(keyed, indent=1, sort_keys=True) + "\n")
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
