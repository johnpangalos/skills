#!/bin/bash
# run_playtest.sh <hidden test file>...: copy hidden playtests in as zz-hidden-*, run only them, remove them
set -u
export MISE_YES=1
names=()
for f in "$@"; do
  n="zz-hidden-$(basename "$f")"; cp "$f" "playtests/tests/$n"; names+=("tests/$n")
done
# older checkouts run vitest directly; newer ones go through Vite+ (vp)
if [ -x node_modules/.bin/vp ] || [ -x playtests/node_modules/.bin/vp ]; then runner=(bun run vp test run); else runner=(bunx vitest run); fi
(cd playtests && "${runner[@]}" "${names[@]}") 2>&1 | grep -vE "^\s*$" | tail -40
status=${PIPESTATUS[0]}
for n in "${names[@]}"; do rm -f "playtests/$n"; done
exit "$status"
