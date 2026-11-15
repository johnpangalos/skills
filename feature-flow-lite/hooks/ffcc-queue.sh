#!/usr/bin/env bash
# feature-flow-lite check cache: the queue for checks the mod runs ahead of time.
#   bash ffcc-queue.sh enqueue <cache dir> <prio> <cwd> <family> <key> <origin> [--replace] -- <command...>
#   bash ffcc-queue.sh work <cache dir>
# enqueue writes one job and starts the repo's worker if none is running; with
# --replace it first drops every queued job of the same origin (a newer tree
# supersedes them). The worker runs one job at a time at the lowest CPU and IO
# priority, cheapest first (lower prio, then the shortest past run in the
# ledger), each through ffcc.sh with FF_CACHE_BG=1: a job whose result is
# already cached, or that an agent is already running, is skipped, and an agent
# that asks for a check the worker is running can preempt it (see ffcc.sh).
here=$(cd "$(dirname "$0")" && pwd)
mode=$1 cache=$2
q=$cache/queue
mkdir -p "$q"

work() {
  exec 8>"$cache/queue.lock"
  while flock -n 8; do
    while :; do
      [ -d "$cache" ] || exit 0
      job=$(pick) || break
      mv "$q/$job" "$cache/queue.running" 2>/dev/null || continue
      run_job "$cache/queue.running"
      rm -f "$cache/queue.running"
    done
    flock -u 8
    # a job enqueued after the last pick but before the unlock starts its own worker only if
    # this one had let go; look once more so it isn't stranded
    [ -n "$(ls -A "$q" 2>/dev/null)" ] || exit 0
  done
}

# The next job: lowest prio, then the shortest past run of its key (60s when unknown).
pick() {
  local best='' bestscore='' f prio key est score
  for f in "$q"/*; do
    [ -f "$f" ] || continue
    prio=${f##*/}; prio=${prio%%-*}
    key=$(sed -n 4p "$f")
    est=$(awk -F'\t' -v k="$key" '$3 == k && $2 != "hit" { s = $6 } END { print (s == "" ? 60 : s) }' "$cache/ledger.tsv" 2>/dev/null)
    score=$(awk -v p="$prio" -v e="${est:-60}" 'BEGIN { printf "%03d%012.1f", p, e }')
    if [ -z "$best" ] || [[ "$score" < "$bestscore" ]]; then best=${f##*/} bestscore=$score; fi
  done
  [ -n "$best" ] && printf '%s\n' "$best"
}

run_job() {
  local f=$1 cwd family key origin
  cwd=$(sed -n 2p "$f") family=$(sed -n 3p "$f") key=$(sed -n 4p "$f") origin=$(sed -n 5p "$f")
  local words=()
  # the arguments are stored one per NUL-separated record from line 6 on
  mapfile -d '' -t words < <(tail -n +6 "$f")
  [ -d "$cwd" ] && [ ${#words[@]} -gt 0 ] || return 0
  local base=
  [ "$origin" = mod-base ] && base=1
  local prio=(nice -n 19)
  command -v ionice >/dev/null 2>&1 && ionice -c3 true 2>/dev/null && prio+=(ionice -c3)
  (cd "$cwd" && FF_CACHE_ORIGIN=$origin FF_CACHE_BG=1 FF_CACHE_BASE=$base CARGO_BUILD_JOBS=1 \
    timeout 900 "${prio[@]}" bash "$here/ffcc.sh" "$cache" - "$family" "$key" -- "${words[@]}" >/dev/null 2>&1)
  return 0
}

case $mode in
  enqueue)
    prio=$3 cwd=$4 family=$5 key=$6 origin=$7
    shift 7
    if [ "$1" = --replace ]; then
      shift
      for f in "$q"/*; do [ -f "$f" ] && [ "$(sed -n 5p "$f")" = "$origin" ] && rm -f "$f"; done
    fi
    [ "$1" = -- ] && shift
    tmp=$(mktemp "$cache/job.XXXXXX")
    { printf 'ffcc-job 1\n%s\n%s\n%s\n%s\n' "$cwd" "$family" "$key" "$origin"; printf '%s\0' "$@"; } >"$tmp"
    mv "$tmp" "$q/$prio-$(date +%s%N)-$$"
    # start the worker, detached, unless one is running
    if (exec 8>"$cache/queue.lock" && flock -n 8); then
      setsid bash "$0" work "$cache" </dev/null >/dev/null 2>&1 &
    fi
    ;;
  work) work ;;
  *) echo "usage: ffcc-queue.sh enqueue|work <cache> ..." >&2; exit 2 ;;
esac
