#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json ids for discount-codes.
set -u; here=$(cd "$(dirname "$0")" && pwd)
d=$(mktemp -d); cp -r "$1"/. "$d"
out=$(cd "$d" && PYTHONPATH="$d" python3 "$here/probe_discounts.py" -v 2>&1)
total=$(grep -c '^    def test_' "$here/probe_discounts.py")
fails=$(grep -oE '^(FAIL|ERROR): test_\w+' <<<"$out" | sed -E 's/.*test_//' | sort -u | tr '_' '-' | tr '\n' ' ')
nf=$(wc -w <<<"$fails"); pass=$((total-nf))
grep -qE '^Ran [0-9]+ test' <<<"$out" || { pass=0; fails="probe-error"; }
[ -n "${PROBE_DEBUG:-}" ] && echo "$out" >&2
echo "$pass/$total $fails"; rm -rf "${d:?}"
