#!/bin/bash
# run the hidden Parameter.spec tests inside the repo's test suite (for its fixtures), then remove them
set -u
target=tests/test_zz_spec_hidden.py
cp "$HIDDEN/test_spec_hidden.py" "$target"
.venv/bin/pytest -q -p no:cacheprovider "$target" 2>&1 | tail -25
status=${PIPESTATUS[0]}
rm -f "$target"
exit "$status"
