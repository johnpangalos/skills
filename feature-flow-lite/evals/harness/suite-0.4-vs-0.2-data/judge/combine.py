"""Pool several blind sets of one task under fresh letters, for one judging pass across all arms.

    python3 combine.py <task> <out root> <label>=<task dir>:<blind-mapping.json> ... [--reports <results.json>:<label>]

Each <task dir> holds <letter>[.diff|-shots] as prepare_blind.py writes them, and its
blind-mapping.json maps those letters to arms. Letters are reassigned by a hash of
(task, label, old letter), so reruns give the same letters. Writes <out root>/<task>/,
<out root>/remap-<task>.json (new letter -> label, old letter, arm, rep) and
<out root>/args-<task>.json (one judge.workflow.js challenge). With --reports, inspector
reports from an earlier judging pass of that label are carried over under the new
letters, so those builds are not inspected again.
"""
import hashlib, json, pathlib, re, shutil, string, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from make_args import challenge

task, out = sys.argv[1], pathlib.Path(sys.argv[2]).resolve()
srcs, reports = [], []
args = sys.argv[3:]
while args:
    a = args.pop(0)
    if a == "--reports":
        reports.append(args.pop(0).rsplit(":", 1))
        continue
    label, rest = a.split("=", 1)
    d, m = rest.rsplit(":", 1)
    srcs.append((label, pathlib.Path(d), json.load(open(m))[task]))

builds = []
for label, d, mapping in srcs:
    for p in sorted(x for x in d.iterdir() if x.is_dir() and not x.name.endswith("-shots")):
        h = hashlib.sha256(f"{task}|{label}|{p.name}".encode()).hexdigest()
        builds.append((h, label, d, p.name, mapping[p.name]))
builds.sort()
dest = out / task
if dest.exists():
    shutil.rmtree(dest)
dest.mkdir(parents=True)
remap = {}
for (h, label, d, old, m), new in zip(builds, string.ascii_uppercase):
    shutil.copytree(d / old, dest / new, symlinks=True)
    for suffix in (".diff", "-shots"):
        src = d / f"{old}{suffix}"
        if src.is_dir():
            shutil.copytree(src, dest / f"{new}{suffix}")
        elif src.exists():
            shutil.copy(src, dest / f"{new}{suffix}")
    remap[new] = {"source": label, "old_letter": old, "arm": m["arm"], "rep": m["rep"]}

ch = challenge(task, dest)
back = {(v["source"], v["old_letter"]): k for k, v in remap.items()}
carried = []
for path, label in reports:
    for res in json.load(open(path)):
        if res and res.get("id") == task:
            # old letters also appear in the text ("Build E", /tmp/inspect-<task>-E, /<task>/E): map them all
            def sub(m, label=label):
                return m.group(1) + back.get((label, m.group(2)), m.group(2))
            pats = [r"(\b[Bb]uilds? )([A-Z])\b", rf"(inspect-{re.escape(task)}-)([A-Z])\b", rf"(/{re.escape(task)}/)([A-Z])\b"]
            for r in res.get("reports", []):
                new = back.get((label, r["letter"]))
                if new:
                    text = json.dumps({k: v for k, v in r.items() if k != "letter"})
                    for p in pats:
                        text = re.sub(p, sub, text)
                    carried.append({**json.loads(text), "letter": new})
if carried:
    ch["reports"] = sorted(carried, key=lambda r: r["letter"])
json.dump(remap, open(out / f"remap-{task}.json", "w"), indent=1)
json.dump(ch, open(out / f"args-{task}.json", "w"), indent=1)
print(f"{task}: {len(remap)} builds, {len(carried)} reports carried over")
