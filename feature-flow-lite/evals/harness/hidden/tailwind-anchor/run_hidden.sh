#!/bin/bash
# run the hidden anchor tests from inside the package, then remove them
set -u
target=packages/tailwindcss/src/anchor.hidden.test.ts
cp "$HIDDEN/anchor.hidden.test.ts" "$target"
pnpm vitest run "$target" 2>&1 | tail -25
status=${PIPESTATUS[0]}
rm -f "$target"
exit "$status"
