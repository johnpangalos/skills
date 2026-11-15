#!/usr/bin/env bash
# Tests for the check cache's shell scripts (ffcc.sh, ffcc-queue.sh,
# ffcc-base.sh) on a throwaway git repo. Plain bash, Linux and macOS:
#   bash hooks/ffcc.test.sh
here=$(cd "$(dirname "$0")" && pwd)
ffcc=$here/ffcc.sh queue=$here/ffcc-queue.sh basesh=$here/ffcc-base.sh
work=$(mktemp -d "${TMPDIR:-/tmp}/ffcc-test.XXXXXX") || exit 1
work=$(cd "$work" && pwd -P)
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$work"' EXIT
passed=0 failed=0
ok() { passed=$((passed + 1)); printf 'ok    %s\n' "$1"; }
bad() { failed=$((failed + 1)); printf 'FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; }
check() { if eval "$2"; then ok "$1"; else bad "$1" "${3:-$2}"; fi; }
# waits up to $2 seconds (default 20) for the condition $1
until_true() { local i=0; while ! eval "$1"; do i=$((i + 1)); [ $i -ge $((${2:-20} * 10)) ] && return 1; sleep 0.1; done; }
count() { [ -f "$1" ] && wc -l <"$1" | tr -d ' ' || echo 0; }

repo=$work/repo
git init -q "$repo" && cd "$repo" || exit 1
git config user.email t@example.com && git config user.name t
printf 'one\n' >a.txt && printf 'out/\n' >.gitignore && git add . && git commit -qm init
cache=$repo/.git/ff-check-cache
mkdir -p "$cache" && git rev-parse HEAD >"$cache/base"
notes=$work/notes.tsv
# run <key> <command...>: one check through the wrapper, as the mod runs it
run() { local key=$1; shift; bash "$ffcc" "$cache" "$notes" node "$key" -- "$@"; }
ledger_has() { awk -F'\t' -v k="$1" -v w="$2" '$3 == k && $2 == w { f = 1 } END { exit !f }' "$cache/ledger.tsv" 2>/dev/null; }
# enqueue with the worker held off, so a test sees the queue as enqueue left it
hold() { exec 7>"$cache/queue.lock"; ( . "$here/ffcc-portable.sh"; ff_lock 7 nb ); }
release() { exec 7>&-; }
enqueue() { bash "$queue" enqueue "$cache" "$@"; }

echo "# platform: $(uname -s), bash $BASH_VERSION"

# --- a miss then a hit; only passes are stored
c=$work/count.pass
o1=$(run pass sh -c "echo ran >>'$c'; echo hello; echo warn >&2" 2>"$work/err1"); s1=$?
o2=$(run pass sh -c "echo ran >>'$c'; echo hello; echo warn >&2" 2>"$work/err2"); s2=$?
check "miss then hit: the command ran once" '[ "$(count "$c")" = 1 ]' "ran $(count "$c") times"
check "miss then hit: the hit replays stdout, stderr and status" '[ "$o2" = hello ] && [ "$(cat "$work/err2")" = warn ] && [ $s1 = 0 ] && [ $s2 = 0 ]'
check "miss then hit: the ledger says miss-pass then hit" 'ledger_has pass miss-pass && ledger_has pass hit'
c=$work/count.fail
run fail sh -c "echo ran >>'$c'; exit 3" >/dev/null; s1=$?
run fail sh -c "echo ran >>'$c'; exit 3" >/dev/null; s2=$?
check "a failure is not stored: it runs again, status kept" '[ "$(count "$c")" = 2 ] && [ $s1 = 3 ] && [ $s2 = 3 ]' "ran $(count "$c") times, statuses $s1 $s2"

# --- a changed file misses (tracked, then untracked); the same content hits again
c=$work/count.change
run change sh -c "echo ran >>'$c'" >/dev/null
printf 'two\n' >a.txt
run change sh -c "echo ran >>'$c'" >/dev/null
check "a changed tracked file misses" '[ "$(count "$c")" = 2 ]' "ran $(count "$c") times"
printf 'new\n' >b.txt
run change sh -c "echo ran >>'$c'" >/dev/null
check "a new untracked file misses" '[ "$(count "$c")" = 3 ]' "ran $(count "$c") times"
rm b.txt && printf 'one\n' >a.txt
run change sh -c "echo ran >>'$c'" >/dev/null
check "back to the first tree: a hit" '[ "$(count "$c")" = 3 ]' "ran $(count "$c") times"
mkdir -p out && printf 'x\n' >out/build.txt
run change sh -c "echo ran >>'$c'" >/dev/null
check "an ignored file doesn't change the key" '[ "$(count "$c")" = 3 ]' "ran $(count "$c") times"
rm -rf out

# --- the key uses the real path: the repo reached through a symlink hits
ln -s "$repo" "$work/link"
c=$work/count.link
run link sh -c "echo ran >>'$c'" >/dev/null
(cd "$work/link" && bash "$ffcc" "$cache" "$notes" node link -- sh -c "echo ran >>'$c'" >/dev/null)
check "through a symlinked path: a hit" '[ "$(count "$c")" = 1 ]' "ran $(count "$c") times"

# --- outside its repo, the wrapper just runs the command
o=$(cd "$work" && bash "$ffcc" "$cache" - node x -- echo plain)
check "outside the repo: runs uncached" '[ "$o" = plain ] && ! ledger_has x miss-pass'

# --- concurrent same-key runs: the second waits and replays the first
c=$work/count.conc
run conc sh -c "echo ran >>'$c'; sleep 1; echo first" >"$work/conc1" &
p1=$!
until_true '[ -s "$c" ]' 5
run conc sh -c "echo ran >>'$c'; echo second" >"$work/conc2"
wait $p1
check "concurrent runs: the command ran once" '[ "$(count "$c")" = 1 ]' "ran $(count "$c") times"
check "concurrent runs: the second replays the first's output" '[ "$(cat "$work/conc2")" = first ]' "got: $(cat "$work/conc2")"
check "concurrent runs: the second is a hit after a wait" 'awk -F"\t" '"'"'$1 == "hit" && $2 == "conc" && $8 > 0.5 { f = 1 } END { exit !f }'"'"' "$notes"'

# --- queue order: lower prio first, then the shortest past run; base (prio 2) last
seed() { printf '%s\tmiss-pass\t%s\t\tseed\t%s\t0\tagent\n' "$(date +%s)" "$1" "$2" >>"$cache/ledger.tsv"; }
seed q-long 100
seed q-short 1
seed q-base 0.5
order=$work/order
hold
enqueue 1 "$repo" node q-long mod -- sh -c "echo long >>'$order'"
enqueue 2 "$repo" node q-base mod-base -- sh -c "echo base >>'$order'"
enqueue 1 "$repo" node q-short mod -- sh -c "echo short >>'$order'"
check "enqueue with the worker lock held starts no worker" '[ "$(ls "$cache/queue" | wc -l | tr -d " ")" = 3 ] && [ ! -f "$order" ]'
release
bash "$queue" work "$cache"
check "queue order: short, then long, then base" '[ "$(tr "\n" " " <"$order")" = "short long base " ]' "got: $(tr '\n' ' ' <"$order" 2>/dev/null)"
check "the queue is empty after the worker" '[ -z "$(ls -A "$cache/queue")" ]'
check "queued runs are in the ledger as the mod's" 'awk -F"\t" '"'"'$3 == "q-short" && $2 == "miss-pass" && $8 == "mod" { f = 1 } END { exit !f }'"'"' "$cache/ledger.tsv"'

# --- --replace drops the older jobs of its origin, and only those
hold
enqueue 1 "$repo" node r-old1 mod -- true
enqueue 1 "$repo" node r-old2 mod -- true
enqueue 2 "$repo" node r-base mod-base -- true
enqueue 1 "$repo" node r-new mod --replace -- true
keys=$(for f in "$cache"/queue/*; do sed -n 4p "$f"; done | sort | tr '\n' ' ')
check "--replace drops older jobs of the same origin" '[ "$keys" = "r-base r-new " ]' "queued: $keys"
rm -f "$cache"/queue/*
release

# --- a job whose result is cached is skipped
c=$work/count.skip
run skip sh -c "echo ran >>'$c'" >/dev/null
hold
enqueue 1 "$repo" node skip mod -- sh -c "echo ran >>'$c'"
release
bash "$queue" work "$cache"
check "a cached job is skipped" '[ "$(count "$c")" = 1 ]' "ran $(count "$c") times"

# --- arguments with spaces, quotes and newlines survive the queue
argsout=$work/args
hold
enqueue 1 "$repo" node args mod -- sh -c 'printf "[%s]" "$@" >"$0"' "$argsout" 'a b' "it's" 'x
y'
release
bash "$queue" work "$cache"
check "queued arguments survive intact" '[ "$(cat "$argsout")" = "[a b][it'"'"'s][x
y]" ]' "got: $(cat "$argsout" 2>/dev/null)"

# --- queued runs get the lowest priority, where this machine allows it
if [ "$(nice -n 19 perl -e 'print getpriority(0, 0)' 2>/dev/null)" = 19 ]; then
  niceout=$work/nice
  hold
  enqueue 1 "$repo" node nice mod -- perl -e "open(my \$f, '>', '$niceout'); print \$f getpriority(0, 0)"
  release
  bash "$queue" work "$cache"
  check "a queued run is at nice 19" '[ "$(tr -d " " <"$niceout")" = 19 ]' "nice: $(cat "$niceout" 2>/dev/null)"
else
  echo "skip  a queued run is at nice 19 (setpriority refused here)"
fi

# --- preemption: an agent asking for a long queued run stops its whole group
seed pre 100
pids=$work/pre.pids
enqueue 1 "$repo" node pre mod -- sh -c "sleep 60 & echo \$! >'$pids'; echo \$\$ >>'$pids'; wait"
if until_true '[ "$(count "$pids")" = 2 ] && [ -f "$cache/locks/"*.bg ]' 20 2>/dev/null; then
  child=$(sed -n 1p "$pids") parent=$(sed -n 2p "$pids")
  t0=$(date +%s)
  o=$(run pre echo agent)
  took=$(($(date +%s) - t0))
  check "preemption: the agent runs its own check at once" '[ "$o" = agent ] && [ $took -lt 15 ]' "output $o after ${took}s"
  until_true '! kill -0 "$child" 2>/dev/null && ! kill -0 "$parent" 2>/dev/null' 10
  check "preemption: the whole process group is gone" '! kill -0 "$child" 2>/dev/null && ! kill -0 "$parent" 2>/dev/null' "alive: $(kill -0 "$parent" 2>/dev/null && echo parent) $(kill -0 "$child" 2>/dev/null && echo child)"
  until_true 'ledger_has pre preempted' 10
  check "preemption: the ledger records preempted" 'ledger_has pre preempted'
  check "preemption: the agent's run is the one stored" '[ "$(run pre echo again)" = agent ]'
else
  bad "preemption: the queued job never started"
fi
until_true '[ ! -f "$cache/queue.running" ]' 20

# --- a queued run that should be done within 30s is waited for
seed near 2
c=$work/count.near
enqueue 1 "$repo" node near mod -- sh -c "echo ran >>'$c'; sleep 2; echo from-queue"
if until_true '[ -s "$c" ]' 20; then
  o=$(run near sh -c "echo ran >>'$c'; echo from-agent")
  check "near-done: the agent waits and replays the queued run" '[ "$o" = from-queue ] && [ "$(count "$c")" = 1 ]' "output $o, ran $(count "$c") times"
  check "near-done: not preempted" '! ledger_has near preempted'
else
  bad "near-done: the queued job never started"
fi
until_true '[ ! -f "$cache/queue.running" ]' 20

# --- ffcc-base.sh: a worktree of the base commit with the ignored paths copied in
mkdir -p out/pkg node_modules/dep
printf 'built\n' >out/pkg/x.js
printf 'node_modules/\n*.tsbuildinfo\n' >>.gitignore && git add .gitignore && git commit -qm ignore
printf 'dep\n' >node_modules/dep/index.js
ln -s dep node_modules/alias
printf 'info\n' >node_modules/dep/app.tsbuildinfo
wt=$work/base-wt
if bash "$basesh" "$repo" "$wt" "$(git rev-parse HEAD)" 2>"$work/base.err"; then
  check "base worktree: ignored files are copied in" '[ "$(cat "$wt/node_modules/dep/index.js")" = dep ] && [ "$(cat "$wt/out/pkg/x.js")" = built ]'
  check "base worktree: copies, not symlinks to the main tree" '[ ! -L "$wt/node_modules" ] && [ ! -L "$wt/out" ]'
  check "base worktree: relative links stay relative" '[ "$(readlink "$wt/node_modules/alias")" = dep ]'
  check "base worktree: files tools rewrite in place are left out" '[ ! -e "$wt/node_modules/dep/app.tsbuildinfo" ]'
  printf 'edited\n' >"$wt/out/pkg/x.js.new" && mv "$wt/out/pkg/x.js.new" "$wt/out/pkg/x.js"
  check "base worktree: replacing a file there leaves the main tree's" '[ "$(cat out/pkg/x.js)" = built ]'
else
  bad "ffcc-base.sh failed" "$(cat "$work/base.err")"
fi
git worktree remove --force "$wt" 2>/dev/null

echo "# $passed passed, $failed failed"
[ "$failed" = 0 ]
