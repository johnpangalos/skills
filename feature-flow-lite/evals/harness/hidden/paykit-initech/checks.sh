#!/bin/bash
# checks.sh <part>: suite | duplication
set -u
case "$1" in
  suite)
    out=$(python3 -m unittest discover -s tests -q 2>&1); status=$?
    echo "$out" | tail -4; exit $status ;;
  duplication)
    # baseline measured on the untouched fixture (see README in this folder)
    python3 "$HIDDEN/duplication.py" . "$(cat "$HIDDEN/duplication_baseline.txt")" ;;
esac
