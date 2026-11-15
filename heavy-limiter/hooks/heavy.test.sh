#!/usr/bin/env bash
# Tests for the machine-wide pool (heavy.pl) on a throwaway pool folder.
# Plain bash, Linux and macOS:  bash heavy-limiter/hooks/heavy.test.sh
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/heavy-test.XXXXXX") || exit 1
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$work"' EXIT
pool=$work/pool
passed=0 failed=0
ok() { passed=$((passed + 1)); printf 'ok    %s\n' "$1"; }
bad() { failed=$((failed + 1)); printf 'FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; }
check() { if eval "$2"; then ok "$1"; else bad "$1" "${3:-$2}"; fi; }
until_true() { local i=0; while ! eval "$1"; do i=$((i + 1)); [ $i -ge $((${2:-20} * 10)) ] && return 1; sleep 0.1; done; }
now() { perl -MTime::HiRes=time -e 'printf "%.2f\n", time'; }
# heavy <budget cores> <budget MB> <cores> <MB> [more options] -- <command...>
heavy() {
  local bc=$1 bm=$2 c=$3 m=$4
  shift 4
  perl "$here/heavy.pl" --dir "$pool" --kind test --key "${KEY:-k}" --cores "$c" --mem "$m" --budget-cores "$bc" --budget-mem "$bm" "$@"
}
# a command that notes when it starts and ends
span() { echo "sh -c 'now() { perl -MTime::HiRes=time -e \"printf q(%.2f), time\"; }; echo \"\$(now) start\" >$work/$1; sleep $2; echo \"\$(now) end\" >>$work/$1'"; }
started() { sed -n 's/ start$//p' "$work/$1"; }
ended() { sed -n 's/ end$//p' "$work/$1"; }
after() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a >= b - 0.05) }'; }
# the same, as a simple command, so a background one's $! is perl itself
hp() { local bc=$1 bm=$2 c=$3 m=$4; shift 4; exec perl "$here/heavy.pl" --dir "$pool" --kind test --key "${KEY:-k}" --cores "$c" --mem "$m" --budget-cores "$bc" --budget-mem "$bm" "$@"; }
participants() { ls "$pool/p" 2>/dev/null | wc -l | tr -d ' '; }

echo "# platform: $(uname -s), perl $(perl -e 'print $^V')"

# --- a command runs, with its output and status, and marks itself as holding a slot
o=$(heavy 4 1000 1 100 -- sh -c 'echo "slot=$CLAUDE_HEAVY_SLOT"; echo err >&2; exit 3' 2>"$work/err"); s=$?
check "output, stderr and status pass through" '[ "$o" = slot=1 ] && [ "$(cat "$work/err")" = err ] && [ $s = 3 ]' "out=$o status=$s"
check "the pool is empty afterwards" '[ "$(participants)" = 0 ]'

# --- two processes, a budget of one: the second waits for the first
eval "heavy 1 1000 1 100 -- $(span a 1.5)" &
until_true '[ -f "$work/a" ]' 10
eval "heavy 1 1000 1 100 -- $(span b 0)" 2>"$work/b.err"
wait
check "budget of one: the second starts after the first ends" 'after "$(started b)" "$(ended a)"' "a ended $(ended a), b started $(started b)"
check "budget of one: the waiter says what it waits on" 'grep -q "waiting for a slot: 1 ahead (test in " "$work/b.err"' "stderr: $(cat "$work/b.err")"

# --- two waiters that joined at the same instant: one starts, then the other (no deadlock)
eval "heavy 1 1000 1 100 -- $(span t0 1)" &
until_true '[ -f "$work/t0" ]' 10
eval "CLAUDE_HEAVY_TEST_ARRIVAL=5.000000 heavy 1 1000 1 100 -- $(span t1 0.3)" 2>/dev/null &
t1=$!
eval "CLAUDE_HEAVY_TEST_ARRIVAL=5.000000 heavy 1 1000 1 100 -- $(span t2 0.3)" 2>/dev/null &
t2=$!
if until_true '[ -n "$(ended t1)" ] && [ -n "$(ended t2)" ]' 15; then
  ok "a tie in arrival: both waiters run"
  check "a tie in arrival: one after the other" 'after "$(started t2)" "$(ended t1)" || after "$(started t1)" "$(ended t2)"'
else
  bad "a tie in arrival: both waiters run" "deadlocked: t1 $(cat "$work/t1" 2>/dev/null | tr '\n' ' '), t2 $(cat "$work/t2" 2>/dev/null | tr '\n' ' ')"
  # the stuck waiters' pids are in their pool files
  for f in "$pool"/p/*; do [ -f "$f" ] && kill "$(cut -f10 "$f")" 2>/dev/null; done
  kill $t1 $t2 2>/dev/null
fi
wait

# --- room for both: they run together
eval "heavy 4 1000 1 100 -- $(span c 1)" &
until_true '[ -f "$work/c" ]' 10
eval "heavy 4 1000 1 100 -- $(span d 0)"
wait
check "room for both: the second doesn't wait" '! after "$(started d)" "$(ended c)"'

# --- memory is a budget too: two 600 MB commands don't share 1000 MB
KEY=membudget eval "heavy 8 1000 1 600 -- $(span e 1)" &
until_true '[ -f "$work/e" ]' 10
KEY=membudget eval "heavy 8 1000 1 600 -- $(span f 0)" 2>/dev/null
wait
check "memory budget: the second waits for the first" 'after "$(started f)" "$(ended e)"'

# --- a command alone always starts, whatever its weight
o=$(heavy 2 1000 16 64000 -- echo alone)
check "a command bigger than the budget runs when alone" '[ "$o" = alone ]'

# --- nested under a held slot: runs at once
eval "heavy 1 1000 1 100 -- $(span g 1.5)" &
until_true '[ -f "$work/g" ]' 10
o=$(CLAUDE_HEAVY_SLOT=1 heavy 1 1000 1 100 -- echo nested)
check "a nested command doesn't take another slot" '[ "$o" = nested ] && [ -z "$(ended g)" ]'
wait

# --- a dead holder is reclaimed
hp 1 1000 1 100 -- sleep 30 &
holder=$!
until_true '[ "$(participants)" = 1 ]' 10
kill -9 $holder
wait $holder 2>/dev/null
t0=$(now)
o=$(heavy 1 1000 1 100 -- echo next)
check "a killed holder's slot is reclaimed at once" '[ "$o" = next ] && awk -v a="$t0" -v b="$(now)" "BEGIN { exit !(b - a < 5) }"'
check "its file is gone" '[ "$(participants)" = 0 ]'
pkill -f 'sleep 30' 2>/dev/null

# --- an agent's command goes ahead of speculative work that waited longer
eval "heavy 1 1000 1 100 -- $(span h 1.5)" &
until_true '[ -f "$work/h" ]' 10
eval "CLAUDE_HEAVY_LOW=1 heavy 1 1000 1 100 -- $(span low 0)" 2>/dev/null &
until_true '[ "$(participants)" = 2 ]' 10
eval "heavy 1 1000 1 100 -- $(span agent 0)" 2>/dev/null &
wait
check "the agent's command runs before the speculative one" 'after "$(started low)" "$(ended agent)"' "agent $(started agent), low $(started low)"

# --- first come, first served: a big waiter holds back smaller ones behind it
eval "heavy 4 1000 2 100 -- $(span i 1.5)" &
until_true '[ -f "$work/i" ]' 10
eval "heavy 4 1000 4 100 -- $(span big 0.5)" 2>/dev/null &
until_true '[ "$(participants)" = 2 ]' 10
eval "heavy 4 1000 1 100 -- $(span small 0)" 2>/dev/null &
wait
check "a big waiter isn't overtaken by a small one" 'after "$(started small)" "$(started big)"' "big $(started big), small $(started small)"

# --- fewer cores when contended: hints
eval "heavy 4 1000 2 100 -- $(span j 1.5)" &
until_true '[ -f "$work/j" ]' 10
o=$(heavy 4 1000 4 100 --min-cores 1 --hint append:--workers= -- sh -c 'echo "$@"' x run)
check "contended: append hint gives the free cores" '[ "$o" = "run --workers=2" ]' "got: $o"
o=$(heavy 4 1000 4 100 --min-cores 1 --hint env:CARGO_BUILD_JOBS -- sh -c 'echo "jobs=$CARGO_BUILD_JOBS"')
check "contended: env hint" '[ "$o" = jobs=2 ]' "got: $o"
o=$(heavy 4 1000 4 100 --min-cores 1 --hint after:4:-p= -- sh -c 'echo "$@"' x test ./...)
check "contended: insert hint" '[ "$o" = "test -p=2 ./..." ]' "got: $o"
o=$(heavy 4 1000 4 100 --min-cores 1 --hint append:--workers= -- sh -c 'echo "$@"' x --workers=3)
check "contended: an explicit setting is kept" '[ "$o" = "--workers=3" ]' "got: $o"
wait
o=$(heavy 4 1000 4 100 --min-cores 1 --hint append:--workers= -- sh -c 'echo "$@"' x run)
check "alone: no hint" '[ "$o" = run ]' "got: $o"

# --- a pass is recorded, and weighs the next run
KEY=rec heavy 4 1000 1 100 -- sleep 0.3
check "a pass is recorded with its duration" 'awk -F"\t" '"'"'$3 == "rec" && $4 >= 0.3 { f = 1 } END { exit !f }'"'"' "$pool/record.tsv"' "$(cat "$pool/record.tsv")"
KEY=recfail heavy 4 1000 1 100 -- false
check "a failure is not recorded" '! grep -q recfail "$pool/record.tsv"'
if ps -p $$ -o pid= >/dev/null 2>&1; then
  KEY=mem heavy 4 1000 1 100 -- perl -e '$x = "a" x 200_000_000; sleep 3'
  peak=$(awk -F'\t' '$3 == "mem" { p = $5 } END { print p }' "$pool/record.tsv")
  check "peak memory is sampled over the command's processes" '[ -n "$peak" ] && [ "$peak" -ge 150 ]' "peak: ${peak:-none} MB"
  # recorded ~200 MB weighs 250 MB: with 300 MB, two can't run together
  KEY=mem eval "heavy 4 300 1 1 -- $(span m1 1)" &
  until_true '[ -f "$work/m1" ]' 10
  KEY=mem eval "heavy 4 300 1 1 -- $(span m2 0)" 2>/dev/null
  wait
  check "the recorded peak is the next run's weight" 'after "$(started m2)" "$(ended m1)"'
else
  echo "skip  peak memory (ps refused here)"
fi

# --- status: the expected wait for a command joining now
KEY=st heavy 1 1000 1 100 -- sleep 1
KEY=st heavy 1 1000 1 100 -- sleep 3 &
until_true '[ "$(participants)" = 1 ]' 10
sleep 0.3
st=$(KEY=st heavy 1 1000 1 100 --status)
check "status: one ahead, a wait from the record" '[ "$(cut -f1 <<<"$st")" = 1 ] && [ "$(cut -f2 <<<"$st")" -ge 1 ]' "status: $st"
wait
check "status: nothing ahead when idle" '[ "$(KEY=st heavy 1 1000 1 100 --status)" = "$(printf "0\t0")" ]'

# --- a waiter that's stopped leaves the pool; a running one passes the signal on
heavy 1 1000 1 100 -- sleep 2 &
until_true '[ "$(participants)" = 1 ]' 10
hp 1 1000 1 100 -- echo never 2>/dev/null &
w=$!
until_true '[ "$(participants)" = 2 ]' 10
kill -TERM $w
wait $w; s=$?
check "a stopped waiter exits 143 and leaves" '[ $s = 143 ] && [ "$(participants)" = 1 ]' "status $s, $(participants) in the pool"
wait
hp 4 1000 1 100 -- sh -c 'trap "echo got-term; exit 9" TERM; sleep 5 & wait' >"$work/term" &
r=$!
until_true '[ "$(participants)" = 1 ]' 10
sleep 0.3
kill -TERM $r
wait $r; s=$?
check "TERM reaches the running command" '[ "$(cat "$work/term")" = got-term ] && [ $s = 9 ] && [ "$(participants)" = 0 ]' "status $s, out $(cat "$work/term")"

# --- the notes file says how long it waited
eval "heavy 1 1000 1 100 -- $(span n 1.2)" &
until_true '[ -f "$work/n" ]' 10
heavy 1 1000 1 100 --notes "$work/notes" -- true 2>/dev/null
wait
check "a wait is written to the notes file" 'awk -F"\t" '"'"'$1 == "waited" && $3 >= 1 && $4 == 1 { f = 1 } END { exit !f }'"'"' "$work/notes"' "notes: $(cat "$work/notes" 2>/dev/null)"

# --- no pool folder it can write: just runs
o=$(perl "$here/heavy.pl" --dir /nonexistent/pool --kind t --key k -- echo free)
check "without a usable pool folder, it just runs" '[ "$o" = free ]'

# --- shell.ts is still feature-flow-lite's parser
ffl=$here/../../feature-flow-lite/hooks/check-cache.ts
if [ -f "$ffl" ]; then
  theirs=$(sed -n '/^\/\/ `subs`: the inner text/,/^export type Family/p' "$ffl" | sed '$d' | grep -v '^const KEYWORDS')
  ours=$(sed -n '/^\/\/ `subs`: the inner text/,$p' "$here/shell.ts")
  check "shell.ts matches feature-flow-lite's parser" '[ "$theirs" = "$ours" ]' "diff: $(diff <(echo "$theirs") <(echo "$ours") | head -5)"
fi

echo "# $passed passed, $failed failed"
[ "$failed" = 0 ]
