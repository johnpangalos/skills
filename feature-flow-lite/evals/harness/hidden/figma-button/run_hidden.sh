#!/bin/bash
# put back the pristine export, tests and config, so a weakened copy can't pass, then measure
set -u
# a build can leave its dev server running on the fixture's port; the test starts its own
lsof -ti tcp:5199 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null; sleep 1
rm -rf figma tests
cp -R "$HIDDEN/pristine/figma" figma && cp -R "$HIDDEN/pristine/tests" tests
cp "$HIDDEN/pristine/playwright.config.ts" playwright.config.ts
pnpm test:figma 2>&1 | tail -40; exit ${PIPESTATUS[0]}
