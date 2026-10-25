#!/bin/bash
# run the hidden Initech tests plus the original Acme and Globex tests (in case a refactor
# changed behavior and edited the repo's own tests to match), then remove them
set -u
mkdir -p tests/zz_hidden && touch tests/zz_hidden/__init__.py
cp "$HIDDEN/test_initech_hidden.py" tests/zz_hidden/test_initech.py
cp "$HIDDEN/acme_original_test.py" tests/zz_hidden/test_acme_original.py
cp "$HIDDEN/globex_original_test.py" tests/zz_hidden/test_globex_original.py
python3 -m unittest -q tests.zz_hidden.test_initech tests.zz_hidden.test_acme_original tests.zz_hidden.test_globex_original 2>&1 | tail -25
status=${PIPESTATUS[0]}
rm -rf tests/zz_hidden
exit "$status"
