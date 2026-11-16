#!/usr/bin/env bash
# contention.sh <dir> <direct|limiter> <label>: three sessions at once, one per
# react-spectrum workspace <dir>/ws1..ws3 (made with feature-flow-lite's
# evals/harness/fixtures/setup_react_spectrum.sh). Each runs `yarn check-types`,
# a jest run over four packages, and `yarn check-types` again, directly or through
# heavy.pl with the weights the mod would give them. The pool is <dir>/pool: delete
# it for a cold run (default weights), keep it for a warm one (measured weights).
# Linux (free -m for the memory peak; bc). Prints the makespan, the peak memory used,
# and each step's exit status and seconds.
B=$(cd "$1" && pwd); mode=$2 label=$3
HEAVY=$(cd "$(dirname "$0")/../hooks" && pwd)/heavy.pl POOL=$B/pool
out=$B/$label; rm -rf "$out"; mkdir -p "$out"
lim() { # kind cores mem min [hint] -- cmd
  local kind=$1 cores=$2 mem=$3 min=$4 hint=$5; shift 5
  local h=(); [ -n "$hint" ] && h=(--hint "$hint")
  if [ "$mode" = limiter ]; then
    perl "$HEAVY" --dir "$POOL" --kind "$kind" --key "$*" --cores "$cores" --mem "$mem" --min-cores "$min" "${h[@]}" --budget-cores 3 --budget-mem 11900 -- "$@"
  else "$@"; fi
}
session() {
  local i=$1 log=$out/s$1.tsv; cd "$B/ws$i"
  step() { local name=$1; shift; local t=$(date +%s.%N); "$@" >"$out/s$i.$name.log" 2>&1; local s=$?; printf '%s\t%s\t%.1f\n' "$name" "$s" "$(echo "$(date +%s.%N) - $t" | bc)" >>"$log"; }
  step types1 lim "yarn check-types" 3 3072 3 "" yarn check-types
  step jest   lim jest 3 3072 1 append:--maxWorkers= yarn jest packages/@react-aria/overlays packages/@react-aria/dialog packages/@react-aria/combobox packages/react-aria-components/test/Popover.test.js
  step types2 lim "yarn check-types" 3 3072 3 "" yarn check-types
}
peak=0; ( while :; do u=$(free -m | awk '/^Mem/ {print $3}'); [ "$u" -gt "$(cat $out/peak 2>/dev/null || echo 0)" ] && echo $u >$out/peak; sleep 0.5; done ) & mon=$!
t0=$(date +%s.%N)
pids=(); for i in 1 2 3; do session $i & pids+=($!); done; wait "${pids[@]}"
kill $mon 2>/dev/null
printf 'makespan %.1f s, peak used %s MB\n' "$(echo "$(date +%s.%N) - $t0" | bc)" "$(cat $out/peak)"
for i in 1 2 3; do echo "s$i: $(awk -F'\t' '{printf "%s=%s(%ss) ", $1, $2, $3}' $out/s$i.tsv)"; done
