#!/bin/bash
# checks.sh <part>: suite | vet | format | regression | scope
set -u
case "$1" in
  suite)
    log=$(mktemp)
    if go test -count=1 ./... >"$log" 2>&1; then cat "$log"; else grep -vE "^(ok|\?) " "$log" | head -20; exit 1; fi ;;
  vet) go vet ./... 2>&1 | head -10; exit "${PIPESTATUS[0]}" ;;
  format)
    bad=$(gofmt -l . 2>&1)
    if [ -n "$bad" ]; then echo "not gofmt-clean: $bad"; exit 1; fi; echo "gofmt clean" ;;
  regression)
    # the fix comes with a regression test of its own in the package's test files
    if git diff HEAD --name-only -- '*_test.go' | grep -q . || git ls-files --others --exclude-standard -- '*_test.go' | grep -q .; then echo "test files changed"; else echo "no test added"; exit 1; fi ;;
  scope)
    # a router bug fix has no reason to touch the middleware package
    files=$(git diff HEAD --name-only; git ls-files --others --exclude-standard)
    echo "$files" | grep -q '^middleware/' && { echo "touched middleware/: $files"; exit 1; }
    echo "changed: $(echo $files | tr '\n' ' ')" ;;
esac
