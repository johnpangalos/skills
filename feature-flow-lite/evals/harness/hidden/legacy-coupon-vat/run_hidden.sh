#!/bin/bash
# run the hidden coupon-VAT tests from the repo's tests/ package, then remove them
set -u
target=tests/test_zz_coupon_vat_hidden.py
cp "$HIDDEN/test_coupon_vat_hidden.py" "$target"
python3 -m unittest -q tests.test_zz_coupon_vat_hidden 2>&1 | tail -25
status=${PIPESTATUS[0]}
rm -f "$target"
exit "$status"
