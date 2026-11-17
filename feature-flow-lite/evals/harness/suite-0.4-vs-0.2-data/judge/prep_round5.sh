#!/bin/bash
# prep_round5.sh <task> ...  (run from the repo root)
# Round 5: rebuilds each task's round-4 pool (prep_round4.sh), then pools it under fresh letters with
# the candidate-0.5c rerun sources in plan5.tsv, carrying the round-4 inspector reports over. Writes
# /tmp/ffj/final5/args.json and /tmp/ffj/final5/remap-<task>.json.
set -euo pipefail
J=feature-flow-lite/evals/harness/suite-0.4-vs-0.2-data/judge
D=$(dirname "$J")
for t in "$@"; do
  bash "$J/prep_round4.sh" "$t" >/dev/null
  python3 - "$t" <<'PY'
import json, sys
t = sys.argv[1]
r = json.load(open(f"/tmp/ffj/final4/remap-{t}.json"))
json.dump({t: {L: {"arm": v["arm"], "rep": v["rep"]} for L, v in r.items()}}, open(f"/tmp/ffj/final4/map-{t}.json", "w"))
PY
  line=$(grep -P "^$t\t" "$J/plan5.tsv")
  results=$(echo "$line" | cut -f2)
  srcs=(); for spec in $(echo "$line" | cut -f3); do
    label=${spec%%=*}; rest=${spec#*=}
    IFS=: read -r branch dir stem <<< "$rest"
    dest=/tmp/ffj/x5-$stem
    if [ ! -d "$dest" ]; then
      mkdir -p "$dest"; git fetch -q origin "$branch"
      git show "FETCH_HEAD:$D/$dir/$stem.tar.gz" | tar xz -C "$dest"
      git show "FETCH_HEAD:$D/$dir/blind-mapping.json" > "$dest/blind-mapping.json"
    fi
    srcs+=("$label=$dest/$stem/$t:$dest/blind-mapping.json")
  done
  python3 "$J/combine.py" "$t" /tmp/ffj/final5 "r4=/tmp/ffj/final4/$t:/tmp/ffj/final4/map-$t.json" "${srcs[@]}" --reports "$J/$results:r4"
done
python3 -c "import json,sys; print(json.dumps([json.load(open(f'/tmp/ffj/final5/args-{t}.json')) for t in sys.argv[1:]]))" "$@" > /tmp/ffj/final5/args.json
echo "wrote /tmp/ffj/final5/args.json for: $*"
