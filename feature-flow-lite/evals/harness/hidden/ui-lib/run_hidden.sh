#!/bin/bash
# copy the hidden tests into the workspace's tests dir, run them, then remove them
set -u
mkdir -p tests && cp "$HIDDEN/hidden.test.tsx" tests/zz_hidden.test.tsx
npx vitest run tests/zz_hidden.test.tsx 2>&1 | tail -25; rc=${PIPESTATUS[0]}
rm -f tests/zz_hidden.test.tsx; exit $rc
