#!/bin/sh
# lint + tests; exits non-zero on the first failure
set -e
cd "$(dirname "$0")"
if command -v ruff >/dev/null 2>&1; then
    ruff check --quiet --no-cache --select E,F,W --ignore E501 shop tests
else
    python3 -m compileall -q shop tests >/dev/null
fi
python3 -m unittest discover -s tests -t . -q
