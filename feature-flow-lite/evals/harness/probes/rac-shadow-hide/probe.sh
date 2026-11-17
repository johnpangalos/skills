#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing...". Runs in place (the workspace holds a 1 GB
# install), with the probe file copied in under a zz_ name and removed afterwards; yarn.lock is
# restored after the lockfile check. Failing ids are the probes/keys.json ids.
# A blind copy (only <letter>.diff and the files it touches, no install) is rebuilt first as the
# pools' BLIND-NOTE.md says: a fresh react-spectrum b8f8d1d tree plus git apply --exclude='bin/*'.
set -u
here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "$1" && pwd); tmp=
if [ ! -d "$src/node_modules" ] && [ -f "$src.diff" ]; then
  tmp=$(mktemp -d)
  (cd "$tmp" && bash "$here/../../fixtures/setup_react_spectrum.sh" b8f8d1d1842ce55063ca67ab3fef7fe172bc3b83 >/dev/null 2>&1 \
    && git apply --exclude='bin/*' "$src.diff") || { echo "0/4 probe-error"; rm -rf "${tmp:?}"; exit 0; }
  src=$tmp
fi
cd "$src"
# yarn-lock: the same check as hidden/rac-shadow-hide/checks.sh lockfile
saved=$(mktemp); cp yarn.lock "$saved"
yarn install --mode=update-lockfile >/dev/null 2>&1
cmp -s yarn.lock "$saved"; lock=$?
cp "$saved" yarn.lock; rm -f "$saved"
t="packages/@react-aria/overlays/test/zz_probe_rac.test.js"
cp "$here/probe.test.js" "$t"
out=$(yarn jest --verbose "$t" 2>&1)
rm -f "$t"
pass=$(grep -c "✓" <<<"$out"); fail=$(grep -c "✕" <<<"$out")
fails=$(grep "✕" <<<"$out" | sed -E 's/.*✕ ([a-z_-]+):.*/\1/' | tr '\n' ' ')
total=$(grep -c "^  it('" "$here/probe.test.js")
if [ $((pass+fail)) -ne "$total" ]; then fails="$fails probe-error"; fi
if [ $lock -eq 0 ]; then pass=$((pass+1)); else fails="$fails yarn-lock"; fi
echo "$pass/$((total+1)) $fails" | tr -s ' '
[ -n "$tmp" ] && rm -rf "${tmp:?}"
exit 0
