#!/usr/bin/env bash
# feature-flow-lite check cache: the wrapper its mod (check-cache.ts) routes each check through.
#   bash ffcc.sh <cache dir> <notes file> <family> <key> -- <command...>
# On a hit it prints the stored output and exits with the stored status; on a
# miss it runs the command, prints its output, and stores it if it passed.
# Runs of the same key wait on one lock, so a second agent replays the first
# one's pass instead of running it again. Outside the repo the cache belongs
# to, it just runs the command.
cache=$1 notes=$2 family=$3 key=$4
shift 4
[ "$1" = -- ] && shift
root=$(git rev-parse --show-toplevel 2>/dev/null) || exec "$@"
own=$(cd "$root" && cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)/ff-check-cache
[ "$own" = "$(cd "$cache" 2>/dev/null && pwd -P)" ] || exec "$@"
rel=${PWD#"$root"}
head=$(git -C "$root" rev-parse HEAD 2>/dev/null || echo none)
base=$(cat "$cache/base" 2>/dev/null || echo none)
# The tree fingerprint: HEAD plus the hash of every modified and untracked non-ignored file.
fingerprint() {
  local changed p
  changed=$({ git -C "$root" diff --name-only -z HEAD -- 2>/dev/null; git -C "$root" ls-files -z -o --exclude-standard 2>/dev/null; } |
    tr '\0' '\n' | grep -vx 'FEATURE_FLOW.md' | grep -v '^$' | sort -u)
  nchanged=0
  local present=() gone=()
  if [ -n "$changed" ]; then
    while IFS= read -r p; do
      nchanged=$((nchanged + 1))
      if [ -f "$root/$p" ]; then present+=("$p"); else gone+=("$p"); fi
    done <<<"$changed"
  fi
  tree=$({
    echo "$head"
    if [ ${#present[@]} -gt 0 ]; then
      paste -d' ' <(printf '%s\n' "${present[@]}" | (cd "$root" && git hash-object --no-filters --stdin-paths)) <(printf '%s\n' "${present[@]}")
    fi
    [ ${#gone[@]} -gt 0 ] && printf 'deleted %s\n' "${gone[@]}"
  } | sha256sum | cut -c1-16)
}
fingerprint
toolchain() {
  case $family in
    go) go env GOVERSION GOFLAGS GOOS GOARCH CGO_ENABLED GOEXPERIMENT 2>/dev/null ;;
    node) node -v 2>/dev/null; echo "NODE_OPTIONS=$NODE_OPTIONS" ;;
    python) python3 -V 2>/dev/null ;;
    rust) rustc -V 2>/dev/null; cargo -V 2>/dev/null ;;
  esac
  local f
  for f in .yarn/install-state.gz node_modules/.yarn-state.yml node_modules/.package-lock.json node_modules/.modules.yaml node_modules .venv/pyvenv.cfg .venv; do
    [ -e "$root/$f" ] && echo "$f $(stat -L -c '%s %Y' "$root/$f")"
  done
  for f in "$root"/.venv/lib/*/site-packages; do [ -d "$f" ] && echo "${f#"$root"} $(stat -L -c '%Y' "$f")"; done
  return 0
}
tools=$(toolchain | sha256sum | cut -c1-16)
k=$(printf '%s\n' "$key" "$rel" "$tree" "$tools" | sha256sum | cut -c1-24)
bk=$(printf '%s\n' "$key" "$rel" "$tools" | sha256sum | cut -c1-24)
entry=$cache/entries/$k
mkdir -p "$cache/entries" "$cache/locks" "$cache/base-results"
[ "$notes" = - ] || mkdir -p "$(dirname "$notes")"
now() { date +%s.%N; }
since() { awk -v a="$1" -v b="$(now)" 'BEGIN { printf "%.1f", b - a }'; }
note() { [ "$notes" = - ] || printf '%s\n' "$1" >>"$notes"; }
# FF_CACHE_ORIGIN says who started the run (an agent, or the mod ahead of time); FF_CACHE_BASE=1
# marks a run on a clean copy of the base commit, whose result is the base commit's.
origin=${FF_CACHE_ORIGIN:-agent}
ledger() { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "$1" "$key" "$rel" "$tree" "$2" "$3" "$origin" >>"$cache/ledger.tsv"; }
exec 9>"$cache/locks/$k"
asked=$(now)
flock -w 3600 9 || true
waited=$(since "$asked")
if [ -f "$entry/status" ]; then
  cat "$entry/out"
  cat "$entry/err" >&2
  seconds=$(cat "$entry/seconds" 2>/dev/null || echo 0)
  age=$(awk -v a="$(cat "$entry/when" 2>/dev/null || date +%s)" -v b="$(date +%s)" 'BEGIN { print b - a }')
  note "$(printf 'hit\t%s\t%s\t%s\t%s\t%s\t%s\t%s' "$key" "$tree" "${head:0:7}" "$nchanged" "$seconds" "$age" "$waited")"
  ledger hit "$seconds" "$waited"
  exit "$(cat "$entry/status")"
fi
tmp=$(mktemp -d "$cache/run.XXXXXX")
started=$(now)
"$@" >"$tmp/out" 2>"$tmp/err" 9>&- &
pid=$!
trap 'kill -TERM $pid 2>/dev/null; cat "$tmp/out"; cat "$tmp/err" >&2; rm -rf "$tmp"; exit 143' TERM INT HUP
wait $pid
status=$?
trap - TERM INT HUP
seconds=$(since "$started")
cat "$tmp/out"
cat "$tmp/err" >&2
atbase=0
{ [ "$nchanged" = 0 ] || [ "${FF_CACHE_BASE:-}" = 1 ]; } && [ "$head" = "$base" ] && atbase=1
# a result counts only if nothing changed the tree while the check ran
ran_on=$tree
fingerprint
steady=0
[ "$tree" = "$ran_on" ] && steady=1
if [ "$atbase" = 1 ] && [ "$steady" = 1 ]; then
  # the base commit's own result, kept pass or fail: "is this failure pre-existing?" is a lookup
  printf '%s\n' "$status" >"$cache/base-results/$bk"
fi
if [ "$status" = 0 ]; then
  if [ "$steady" = 1 ] && [ "${FF_CACHE_BASE:-}" != 1 ]; then
    printf '%s\n' "$status" >"$tmp/status.new"
    printf '%s\n' "$seconds" >"$tmp/seconds"
    date +%s >"$tmp/when"
    printf '%s\n%s\n%s\n' "$key" "$rel" "$ran_on" >"$tmp/key"
    mv "$tmp/status.new" "$tmp/status"
    rm -rf "$entry"
    mv "$tmp" "$entry" 2>/dev/null || rm -rf "$tmp"
  else
    rm -rf "$tmp"
  fi
  note "$(printf 'pass\t%s\t%s\t%s' "$key" "$ran_on" "$seconds")"
  ledger miss-pass "$seconds" "$waited"
else
  rm -rf "$tmp"
  bs=
  [ "$atbase" = 1 ] || bs=$(cat "$cache/base-results/$bk" 2>/dev/null)
  note "$(printf 'fail\t%s\t%s\t%s\t%s' "$key" "$status" "${base:0:7}" "$bs")"
  ledger miss-fail "$seconds" "$waited"
fi
exit "$status"
