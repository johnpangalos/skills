#!/bin/bash
# checks.sh <part>: suite | clippy | format | changelog | manpage | completion
set -u
case "$1" in
  suite)
    log=$(mktemp)
    if cargo test -q >"$log" 2>&1; then grep "test result" "$log"; else grep -E "FAILED|panicked|error(\[|:)|test result" "$log" | head -15; exit 1; fi ;;
  clippy)
    log=$(mktemp)
    if cargo clippy -q --all-targets -- -D warnings >"$log" 2>&1; then echo "no clippy warnings"; else head -20 "$log"; exit 1; fi ;;
  format) cargo fmt --check 2>&1 | head -20; exit "${PIPESTATUS[0]}" ;;
  changelog)
    python3 - <<'PY'
import re, sys
text = open("CHANGELOG.md").read()
upcoming = re.split(r"^# Upcoming release", text, maxsplit=1, flags=re.M | re.I)[1].split("\n# ", 1)[0]
if "--count" not in upcoming:
    sys.exit("no --count entry under Upcoming Release")
print("changelog entry present")
PY
    ;;
  manpage) grep -q -- '\\-\\-count' doc/fd.1 && echo "documented in doc/fd.1" || { echo "--count missing from doc/fd.1"; exit 1; } ;;
  completion) grep -q -- '--count' contrib/completion/_fd && echo "in the zsh completion" || { echo "--count missing from contrib/completion/_fd"; exit 1; } ;;
esac
