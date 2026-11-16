#!/usr/bin/env bash
# Tests for the check cache's wrapper (ffcc.sh) on a throwaway git repo.
# Plain bash, Linux and macOS:
#   bash hooks/ffcc.test.sh
here=$(cd "$(dirname "$0")" && pwd)
ffcc=$here/ffcc.sh
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

# --- the base commit's result is kept, pass or fail, and a later failure says which
rm -f "$notes"
run basefail sh -c 'exit 2' >/dev/null 2>&1
check "base commit: a failure on the clean base tree is recorded" '[ -n "$(ls "$cache/base-results")" ]'
printf 'later\n' >later.txt
run basefail sh -c 'exit 2' >/dev/null 2>&1
check "base commit: a later failure notes it failed at the base too" 'awk -F"\t" '"'"'$1 == "fail" && $2 == "basefail" && $5 == "2" { f = 1 } END { exit !f }'"'"' "$notes"' "notes: $(cat "$notes")"
rm -f later.txt

# --- with heavy-limiter's wrapper inside this one, the agent's check holds a pool slot
heavy=$here/../../heavy-limiter/hooks/heavy.pl
if [ -f "$heavy" ] && command -v perl >/dev/null 2>&1; then
  pool=$work/pool && mkdir -p "$pool/p" "$pool/notes"
  out=$work/h1.out
  IFS=$'\n' read -r -d '' -a a < <(
    printf '%s\n' perl "$heavy" --dir "$pool" --kind test --key h1 --cores 1 --mem 64 --notes "$pool/notes/agent" --
    printf '%s\n' sh -c "echo \"slot=\${CLAUDE_HEAVY_SLOT:-}\" >>'$out'"
    printf '\0')
  run h1 "${a[@]}" >/dev/null
  check "limited: the agent's run held a slot" 'grep -q "slot=1" "$out"' "got: $(cat "$out")"
  run h1 "${a[@]}" >/dev/null
  check "limited: a replayed pass takes no slot" '[ "$(count "$out")" = 1 ]' "ran $(count "$out") times"
else
  echo "# heavy-limiter not found next to feature-flow-lite: its tests skipped"
fi

echo "# $passed passed, $failed failed"
[ "$failed" = 0 ]
