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
missing = [w for w in ("spec", "human_readable_name") if w not in section]
if missing:
    sys.exit(f"Version 8.6.0 section doesn't mention {missing}")
print("changelog entries present")
PY
    ;;
  docs)
    grep -q "human_readable_name" docs/upgrade-guides.md || { echo "docs/upgrade-guides.md doesn't cover the deprecation"; exit 1; }
    grep -qE "\bspec\b" docs/parameters.md || { echo "docs/parameters.md doesn't explain spec"; exit 1; }
    echo "upgrade guide and parameters docs updated" ;;
esac
