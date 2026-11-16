#!/bin/bash
# prep_final.sh <task> ...  (run from the repo root)
# For each task in plan.tsv: fetches the base (0.2 + 0.4) and criteria-arm blind tarballs from
# their worker branches, pools them under fresh letters with combine.py, and writes
# /tmp/ffj/final/args.json (the judge.workflow.js args for these tasks) plus remap-<task>.json.
set -euo pipefail
J=feature-flow-lite/evals/harness/suite-0.4-vs-0.2-data/judge
D=$(dirname "$J")
fetch() {  # fetch <branch> <path-in-branch> <dest dir>
  [ -d "$3" ] && return
  mkdir -p "$3"; git fetch -q origin "$1"; git show "FETCH_HEAD:$2" | tar xz -C "$3"
}
for t in "$@"; do
  read -r _ s sb c cb rep < <(grep -P "^$t\t" "$J/plan.tsv")
  fetch "$sb" "$D/slice-$s/ff-judge-$s.tar.gz" /tmp/ffj/s$s
  fetch "$cb" "$D/criteria-$c/ff-judge-c$c.tar.gz" /tmp/ffj/c$c
  extra=(); [ "$rep" != "-" ] && extra=(--reports "$J/$rep:base")
  python3 "$J/combine.py" "$t" /tmp/ffj/final \
    "base=/tmp/ffj/s$s/ff-judge-$s/$t:$D/slice-$s/blind-mapping.json" \
    "crit=/tmp/ffj/c$c/ff-judge-c$c/$t:$D/criteria-$c/blind-mapping.json" "${extra[@]}"
done
python3 -c "import json,sys; print(json.dumps([json.load(open(f'/tmp/ffj/final/args-{t}.json')) for t in sys.argv[1:]]))" "$@" > /tmp/ffj/final/args.json
echo "wrote /tmp/ffj/final/args.json for: $*"
