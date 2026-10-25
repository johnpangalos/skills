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
    out=$(stylua --check ./src 2>&1) || { echo "$out" | grep -E "^Diff in" | head -10; echo "stylua --check failed"; exit 1; }
    echo "stylua clean" ;;
  jscheck)
    # only when the run touched TypeScript
    if ! { git diff HEAD --name-only; git ls-files --others --exclude-standard; } | grep -qE '\.(ts|tsx)$'; then echo "no TS changes"; exit 0; fi
    (cd web && bun run typegen >/dev/null 2>&1)
    bun run vp check 2>&1 | tail -3; exit "${PIPESTATUS[0]}" ;;
  playtest-added)
    if { git diff HEAD --name-only; git ls-files --others --exclude-standard; } | grep -qE '^(playtests/tests/.*\.test\.ts|tests/.*_spec\.lua)$'; then echo "tests changed"; else echo "no playtest or spec added"; exit 1; fi ;;
esac
