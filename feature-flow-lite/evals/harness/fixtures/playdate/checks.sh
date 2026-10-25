#!/bin/bash
# checks.sh <part> for playdate-game-01 runs: unit | playtests | lint | format | jscheck | playtest-added
# Runs from the workspace root. mise installs the pinned Lua, stylua and bun on first use.
set -u
export MISE_YES=1
case "$1" in
  unit)
    log=$(mktemp)
    if mise run test >"$log" 2>&1; then tail -1 "$log"; else grep -E "^FAIL|Error|error" "$log" | head -20; tail -3 "$log"; exit 1; fi ;;
  playtests)
    log=$(mktemp)
    if mise run //playtests:test >"$log" 2>&1; then grep -E "Tests " "$log"; else grep -E "FAIL|Tests |Error" "$log" | head -20; exit 1; fi ;;
  lint) mise run lint 2>&1 | tail -3; exit "${PIPESTATUS[0]}" ;;
  format)
    # only the Lua files the run changed, so formatting drift already in the pinned commit doesn't count
    files=$({ git diff HEAD --name-only --diff-filter=AM; git ls-files --others --exclude-standard; } | grep -E '\.lua$' | sort -u)
    [ -z "$files" ] && { echo "no Lua changes"; exit 0; }
    out=$(stylua --check $files 2>&1) || { echo "$out" | grep -E "^Diff in" | head -10; echo "stylua --check failed"; exit 1; }
    echo "stylua clean on $(echo $files | wc -w) files" ;;
  jscheck)
    # only when the run touched TypeScript
    if ! { git diff HEAD --name-only; git ls-files --others --exclude-standard; } | grep -qE '\.(ts|tsx)$'; then echo "no TS changes"; exit 0; fi
    (cd web && bun run typegen >/dev/null 2>&1)
    if [ -x node_modules/.bin/vp ]; then bun run vp check 2>&1 | tail -3; exit "${PIPESTATUS[0]}"; fi
    # older checkouts: typecheck the playtests and server workspaces with tsc
    status=0
    for ws in playtests server; do [ -f "$ws/tsconfig.json" ] && { (cd "$ws" && bunx tsc --noEmit -p . 2>&1 | tail -5) || status=1; }; done
    exit $status ;;
  playtest-added)
    if { git diff HEAD --name-only; git ls-files --others --exclude-standard; } | grep -qE '^(playtests/tests/.*\.test\.ts|tests/.*_spec\.lua)$'; then echo "tests changed"; else echo "no playtest or spec added"; exit 1; fi ;;
esac
