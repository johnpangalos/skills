#!/bin/bash
# put back the pristine export, tests and config, so a weakened copy can't pass, then run the
# spec named by $1: "values" (the Figma measurement) or "behaviour" (the hidden keyboard tests)
set -u
rm -rf figma tests
cp -R "$HIDDEN/pristine/figma" figma && cp -R "$HIDDEN/pristine/tests" tests
cp "$HIDDEN/pristine/playwright.config.ts" playwright.config.ts
if [ "${1:-values}" = behaviour ]; then
  cp "$HIDDEN/behaviour.spec.ts" tests/zz_behaviour.spec.ts
  pnpm exec playwright test zz_behaviour 2>&1 | tail -40; rc=${PIPESTATUS[0]}
  rm -f tests/zz_behaviour.spec.ts; exit $rc
fi
pnpm exec playwright test tabs.figma 2>&1 | tail -40; exit ${PIPESTATUS[0]}
