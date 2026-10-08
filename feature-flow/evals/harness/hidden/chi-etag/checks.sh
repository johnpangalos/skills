#!/bin/bash
# checks.sh <part>: suite | vet | format | readme
set -u
case "$1" in
  suite)
    log=$(mktemp)
    if go test -count=1 ./... >"$log" 2>&1; then cat "$log"; else grep -vE "^(ok|\?) " "$log" | head -20; exit 1; fi ;;
  vet) go vet ./... 2>&1 | head -10; exit "${PIPESTATUS[0]}" ;;
  format)
    bad=$(gofmt -l . 2>&1)
    if [ -n "$bad" ]; then echo "not gofmt-clean: $bad"; exit 1; fi; echo "gofmt clean" ;;
  readme)
    python3 - <<'PY'
import re, sys
text = open("README.md").read()
if not re.search(r"^\|\s*\[ETag\]\s*\|", text, re.M):
    sys.exit("no [ETag] row in the README middleware table")
if not re.search(r"^\[ETag\]:\s*https://pkg\.go\.dev/github\.com/go-chi/chi/v5/middleware#ETag", text, re.M):
    sys.exit("no [ETag] link reference to pkg.go.dev")
print("README row and link present")
PY
    ;;
esac
