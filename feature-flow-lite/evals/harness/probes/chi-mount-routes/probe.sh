#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json ids for chi-mount-routes.
set -u; here=$(cd "$(dirname "$0")" && pwd)
d=$(mktemp -d); cp -r "$1"/. "$d"; mkdir -p "$d/zzchiprobe"; cp "$here/probe_test.go" "$d/zzchiprobe/"
out=$(cd "$d" && go test -count=1 -v ./zzchiprobe/ 2>&1)
total=$(grep -c '^func TestKey_' "$here/probe_test.go")
pass=$(grep -c -- '--- \(PASS\|SKIP\): TestKey_' <<<"$out")
fails=$(grep -o -- '--- FAIL: TestKey_[a-z_]*' <<<"$out" | sed 's/--- FAIL: TestKey_//' | tr '_' '-' | tr '\n' ' ')
[ $((pass + $(wc -w <<<"$fails"))) -ne "$total" ] && fails="$fails probe-error"
[ -n "${PROBE_DEBUG:-}" ] && echo "$out" >&2
echo "$pass/$total $fails"; rm -rf "${d:?}"
