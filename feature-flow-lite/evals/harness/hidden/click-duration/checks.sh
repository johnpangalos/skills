#!/bin/bash
# checks.sh <part>: suite | types | lint | changelog | docs
set -u
case "$1" in
  suite)
    log=$(mktemp)
    if .venv/bin/pytest -q -p no:cacheprovider >"$log" 2>&1; then tail -2 "$log"; else grep -E "FAILED|ERROR|passed|failed" "$log" | tail -15; exit 1; fi ;;
  types) .venv/bin/mypy 2>&1 | tail -10; exit "${PIPESTATUS[0]}" ;;
  lint)
    .venv/bin/ruff check --no-fix --no-cache src tests docs && .venv/bin/ruff format --check --no-cache src tests docs ;;
  changelog)
    python3 - <<'PY'
import re, sys
text = open("CHANGES.md").read()
section = text.split("## Version 8.6.0", 1)[1].split("\n## Version", 1)[0]
if not re.search(r"Duration", section):
    sys.exit("no Duration entry under Version 8.6.0 (Unreleased)")
print("changelog entry present")
PY
    ;;
  docs)
    if grep -q "autoclass:: Duration" docs/api.md && grep -qE "Duration" docs/parameter-types.md; then
      echo "documented in api.md and parameter-types.md"
    else
      echo "missing from docs/api.md or docs/parameter-types.md"; exit 1
    fi ;;
esac
