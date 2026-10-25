#!/bin/bash
# the upstream playtests for this change, copied in under zz-hidden-* names. Two upstream tests pin
# details the prompt doesn't ask for (a camera look-ahead change, and no second hop inside the wall
# coyote window), so they're skipped.
SKIP_TESTS='leads downward during a long fall|spends the window on the jump it buys' bash "$FIXTURES/playdate/run_playtest.sh" "$HIDDEN/jumping.test.ts" "$HIDDEN/camera.test.ts"
