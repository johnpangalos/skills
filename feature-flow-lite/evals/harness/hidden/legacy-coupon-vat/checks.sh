#!/bin/bash
# checks.sh <part>: suite | regression | scope
set -u
case "$1" in
  suite)
    out=$(python3 -m unittest discover -s tests -q 2>&1); status=$?
    echo "$out" | tail -4; exit $status ;;
  regression)
    # the fix comes with a regression test of its own
    if git diff HEAD --name-only -- 'tests/*.py' | grep -q . || git ls-files --others --exclude-standard -- 'tests/*.py' | grep -q .; then
      echo "tests changed: $(git diff HEAD --name-only -- 'tests/*.py'; git ls-files --others --exclude-standard -- 'tests/*.py')"
    else echo "no regression test added"; exit 1; fi ;;
  scope)
    # a pricing bug fix has no reason to touch the back-office domains
    files=$(git diff HEAD --name-only; git ls-files --others --exclude-standard)
    bad=$(echo "$files" | grep -E '^ledgerline/(inventory|crm|shipping_ops|notifications|reporting|auth|scheduling|warehouse|analytics|integrations|catalog|support)/' || true)
    if [ -n "$bad" ]; then echo "touched unrelated domains: $bad"; exit 1; fi
    echo "changed: $(echo $files | tr '\n' ' ')" ;;
esac
