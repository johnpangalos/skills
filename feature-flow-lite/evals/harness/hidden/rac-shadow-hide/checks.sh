#!/bin/bash
# checks.sh <check>: the rac-shadow-hide outcome checks, run in the workspace. None of them leaves
# a change behind: the hidden test is copied in and removed, and yarn.lock is restored.
set -uo pipefail
HIDDEN=$(cd "$(dirname "$0")" && pwd)
case "$1" in
  hidden)
    t=packages/@react-aria/overlays/test/zz_hidden_shadow.test.js
    cp "$HIDDEN/ariaHideOutside.shadow.test.js" "$t"
    yarn jest "$t" 2>&1 | grep -E "✕|Tests:"; rc=${PIPESTATUS[0]}
    rm -f "$t"; exit "$rc" ;;
  suite)
    out=$(yarn jest packages/@react-aria packages/react-aria-components 2>&1); rc=$?
    grep -E "^FAIL|^Tests:|^Test Suites:" <<<"$out" | sort -u | head -12; exit "$rc" ;;
  lint)
    yarn eslint packages/@react-aria/overlays packages/@react-aria/utils 2>&1 | tail -12; exit "${PIPESTATUS[0]}" ;;
  types)
    yarn check-types 2>&1 | tail -12; exit "${PIPESTATUS[0]}" ;;
  lockfile)
    saved=$(mktemp); cp yarn.lock "$saved"
    yarn install --mode=update-lockfile >/dev/null 2>&1
    if cmp -s yarn.lock "$saved"; then rc=0; else diff "$saved" yarn.lock | head -8; rc=1; fi
    cp "$saved" yarn.lock; rm -f "$saved"; exit "$rc" ;;
  tests-added)
    git add -A -N packages/@react-aria/overlays/test >/dev/null 2>&1
    changed=$(git diff --name-only HEAD -- packages/@react-aria/overlays/test)
    [ -n "$changed" ] && grep -li shadow $changed >/dev/null && { echo "$changed"; exit 0; }
    echo "no shadow DOM test added next to the ariaHideOutside tests"; exit 1 ;;
esac
echo "unknown check $1"; exit 2
