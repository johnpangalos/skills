#!/bin/bash
# build fd and run the black-box --count tests against the binary
set -u
cargo build -q 2>&1 | tail -20
[ "${PIPESTATUS[0]}" -eq 0 ] || exit 1
python3 "$HIDDEN/check_count.py" target/debug/fd
