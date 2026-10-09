#!/bin/bash
# probe.sh <build dir>: prints "pass/total" and failing probe names
set -u
d=$(mktemp -d); cp -r "$1"/. "$d"; mkdir -p "$d/middleware/etagprobe"
cp "$(dirname "$0")/probe_test.go" "$d/middleware/etagprobe/"
out=$(cd "$d" && go test -count=1 -v ./middleware/etagprobe/ 2>&1)
pass=$(grep -c -- '--- PASS: TestProbe' <<<"$out"); fail=$(grep -o -- '--- FAIL: TestProbe[A-Za-z]*' <<<"$out" | sed 's/--- FAIL: TestProbe//' | tr '\n' ' ')
echo "$pass/7 $fail"; rm -rf "$d"
