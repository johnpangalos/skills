import json, pathlib, re, subprocess, sys, collections
H = pathlib.Path("hidden").resolve()
batch = pathlib.Path(sys.argv[1]); out = {}
rows = collections.defaultdict(list); fails = collections.defaultdict(collections.Counter)
for mp in sorted(batch.glob("*/*/rep-*/meta.json")):
    m = json.loads(mp.read_text()); ws = pathlib.Path(m["workspace"]); sid = m["scenario"]
    if sid == "fd-count":
        subprocess.run("cargo build -q", shell=True, cwd=ws, capture_output=True)
        p = subprocess.run(["python3", str(H/"fd-count/check_count.py"), "target/debug/fd"], cwd=ws, capture_output=True, text=True)
        cases = {l[5:].split(":")[0].strip(): l.startswith("ok") for l in p.stdout.splitlines() if l[:5] in ("ok   ", "FAIL ")}
    else:
        t = ws/"tests/test_zz_spec_hidden.py"; t.write_text((H/"click-param-spec/test_spec_hidden.py").read_text())
        p = subprocess.run([".venv/bin/pytest", "-v", "-p", "no:cacheprovider", str(t)], cwd=ws, capture_output=True, text=True); t.unlink()
        cases = {mm.group(1): mm.group(2) == "PASSED" for mm in re.finditer(r"::(\S+) (PASSED|FAILED|ERROR)", p.stdout)}
    out[str(mp.parent)] = cases; rows[(sid, m["arm"])].append(cases)
    for k, v in cases.items():
        if not v: fails[(sid, m["arm"])][k] += 1
print("| scenario | arm | runs | cases passed (per run) | all passed |\n|---|---|---|---|---|")
for (sid, arm), rs in sorted(rows.items()):
    print(f"| {sid} | {arm} | {len(rs)} | {', '.join(f'{sum(c.values())}/{len(c)}' for c in rs)} | {sum(all(c.values()) and bool(c) for c in rs)} |")
for k, c in sorted(fails.items()): print(f"- {k[0]} / {k[1]}: " + ", ".join(f"{n} x{v}" for n, v in c.items()))
(batch/"hidden_cases_by_runner.json").write_text(json.dumps(out, indent=2))
