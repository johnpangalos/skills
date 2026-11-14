#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing...". Runs in place (the workspace holds a 1 GB
# install), with the probe file copied in under a zz_ name and removed afterwards.
set -u
here=$(cd "$(dirname "$0")" && pwd)
t="$1/packages/@react-aria/overlays/test/zz_probe_rac.test.js"
cp "$here/probe.test.js" "$t"
out=$(cd "$1" && yarn jest --verbose "packages/@react-aria/overlays/test/zz_probe_rac.test.js" 2>&1)
rm -f "$t"
pass=$(grep -c "✓" <<<"$out"); fail=$(grep -c "✕" <<<"$out")
fails=$(grep "✕" <<<"$out" | sed -E 's/.*✕ ([a-z_]+):.*/\1/' | tr '\n' ' ')
echo "$pass/$((pass+fail)) $fails"
