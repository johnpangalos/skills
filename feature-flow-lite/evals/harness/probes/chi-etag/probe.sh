#!/bin/bash
# probe.sh <build dir>: prints "pass/total" and failing probe names. TestKey_* probes report the
# probes/keys.json ids (underscores -> hyphens).
set -u
d=$(mktemp -d); cp -r "$1"/. "$d"; mkdir -p "$d/middleware/etagprobe"
cp "$(dirname "$0")/probe_test.go" "$d/middleware/etagprobe/"
out=$(cd "$d" && go test -count=1 -v ./middleware/etagprobe/ 2>&1)
pass=$(grep -c -- '--- PASS: Test\(Probe\|Key_\)' <<<"$out")
fail=$(grep -o -- '--- FAIL: Test\(Probe[A-Za-z]*\|Key_[a-z_]*\)' <<<"$out" | sed -e 's/--- FAIL: TestProbe//' -e 's/--- FAIL: TestKey_//' -e '/^[a-z_]*$/y/_/-/' | tr '\n' ' ')
total=$(grep -c '^func Test\(Probe\|Key_\)' "$(dirname "$0")/probe_test.go")
# a probe file that doesn't compile fails every probe
grep -q '^FAIL\s.*\[build failed\]\|^# ' <<<"$out" && { echo "0/$total build-failed"; rm -rf "$d"; exit 0; }
echo "$pass/$total $fail"; rm -rf "$d"
