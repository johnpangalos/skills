#!/bin/bash
# prep_round3.sh <task> ...  (run from the repo root)
# Round 3: lite-candidate against lite-shipped-0.2 only. For each task in plan3.tsv, rebuilds the
# earlier pool (prep_round2.sh for round 2, prep_final.sh for round 1), keeps only its 0.2 builds
# under their earlier letters, and pools them with the candidate builds under fresh letters,
# carrying the earlier inspector reports for the 0.2 builds over. Writes /tmp/ffj/final3/args.json
# and /tmp/ffj/final3/remap-<task>.json (letter -> source, old letter, arm, rep).
set -euo pipefail
J=feature-flow-lite/evals/harness/suite-0.4-vs-0.2-data/judge
D=$(dirname "$J")
for t in "$@"; do
  line=$(grep -P "^$t\t" "$J/plan3.tsv")
  round=$(echo "$line" | cut -f2); results=$(echo "$line" | cut -f3); cand=$(echo "$line" | cut -f4)
  if [ "$round" = 2 ]; then bash "$J/prep_round2.sh" "$t" >/dev/null; pool=/tmp/ffj/final2
  else bash "$J/prep_final.sh" "$t" >/dev/null; pool=/tmp/ffj/final; fi
  rm -rf "/tmp/ffj/p02/$t"; mkdir -p "/tmp/ffj/p02/$t"
  python3 - "$t" "$pool" <<'PY'
import json, shutil, sys, pathlib
t, pool = sys.argv[1], pathlib.Path(sys.argv[2])
remap = json.load(open(pool / f"remap-{t}.json"))
keep = {L: {"arm": v["arm"], "rep": v["rep"]} for L, v in remap.items() if v["arm"] == "lite-shipped-0.2"}
src, dst = pool / t, pathlib.Path("/tmp/ffj/p02") / t
for L in keep:
    shutil.copytree(src / L, dst / L, symlinks=True)
    for suf in (".diff", "-shots"):
        p = src / f"{L}{suf}"
        if p.is_dir(): shutil.copytree(p, dst / f"{L}{suf}")
        elif p.exists(): shutil.copy(p, dst / f"{L}{suf}")
json.dump({t: keep}, open(f"/tmp/ffj/p02/map-{t}.json", "w"))
print(f"{t}: {len(keep)} 0.2 builds kept from {pool}")
PY
  IFS=: read -r branch dir stem <<< "$cand"
  dest=/tmp/ffj/x3-$stem
  if [ ! -d "$dest" ]; then
    mkdir -p "$dest"; git fetch -q origin "$branch"
    git show "FETCH_HEAD:$D/$dir/$stem.tar.gz" | tar xz -C "$dest"
    git show "FETCH_HEAD:$D/$dir/blind-mapping.json" > "$dest/blind-mapping.json"
  fi
  python3 "$J/combine.py" "$t" /tmp/ffj/final3 "r=/tmp/ffj/p02/$t:/tmp/ffj/p02/map-$t.json" \
    "cand=$dest/$stem/$t:$dest/blind-mapping.json" --reports "$J/$results:r"
done
python3 -c "import json,sys; print(json.dumps([json.load(open(f'/tmp/ffj/final3/args-{t}.json')) for t in sys.argv[1:]]))" "$@" > /tmp/ffj/final3/args.json
echo "wrote /tmp/ffj/final3/args.json for: $*"
