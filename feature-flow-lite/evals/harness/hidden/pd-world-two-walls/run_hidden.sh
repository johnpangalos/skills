#!/bin/bash
# the upstream level_source spec (with its tileset tests), plus: every world-two level names the theme
set -u
bash "$FIXTURES/playdate/run_spec.sh" "$HIDDEN/level_source_spec.lua"; status=$?
missing=$(grep -L '"tileset": *"world-two"' src/levels/world-two-*.level.json)
if [ -n "$missing" ]; then echo "world-two levels without \"tileset\": \"world-two\": $missing"; status=1; fi
exit $status
