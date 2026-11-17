#!/bin/bash
# prep_round2.sh <task> ...  (run from the repo root)
# Rebuilds each task's round-1 pool (prep_final.sh), then pools it again under fresh letters with
# the extra sources in plan2.tsv, carrying the round-1 inspector reports over. Writes
# /tmp/ffj/final2/args.json and /tmp/ffj/final2/remap-<task>.json (letters -> source, arm, rep).
set -euo pipefail
J=feature-flow-lite/evals/harness/suite-0.4-vs-0.2-data/judge
D=$(dirname "$J")
for t in "$@"; do
  bash "$J/prep_final.sh" "$t" >/dev/null
  mkdir -p /tmp/ffj/prev; rm -rf "/tmp/ffj/prev/$t"; mv "/tmp/ffj/final/$t" "/tmp/ffj/prev/$t"
  python3 - "$t" "$J" <<'PY'
import json, sys
t, J = sys.argv[1], sys.argv[2]
r = json.load(open(f"{J}/remap-{t}.json"))
json.dump({t: {L: {"arm": v["arm"], "rep": v["rep"]} for L, v in r.items()}}, open(f"/tmp/ffj/prev/map-{t}.json", "w"))
PY
  line=$(grep -P "^$t\t" "$J/plan2.tsv")
  results=$(echo "$line" | cut -f2)
  srcs=(); for spec in $(echo "$line" | cut -f3); do
    label=${spec%%=*}; rest=${spec#*=}
    IFS=: read -r branch dir stem map <<< "$rest"
    dest=/tmp/ffj/x2-$stem
    if [ ! -d "$dest" ]; then
      mkdir -p "$dest"; git fetch -q origin "$branch"
      git show "FETCH_HEAD:$D/$dir/$stem.tar.gz" | tar xz -C "$dest"
    fi
    srcs+=("$label=$dest/$stem/$t:$D/$dir/$map")
  done
  python3 "$J/combine.py" "$t" /tmp/ffj/final2 "prev=/tmp/ffj/prev/$t:/tmp/ffj/prev/map-$t.json" "${srcs[@]}" --reports "$J/$results:prev"
done
python3 -c "import json,sys; print(json.dumps([json.load(open(f'/tmp/ffj/final2/args-{t}.json')) for t in sys.argv[1:]]))" "$@" > /tmp/ffj/final2/args.json
echo "wrote /tmp/ffj/final2/args.json for: $*"
