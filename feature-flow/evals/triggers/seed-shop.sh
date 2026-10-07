#!/bin/bash
# seed the shop fixture repo so prompts about shop/* have something to land on
set -euo pipefail
src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../harness/fixtures/shop"
cp -R "$src/." .
git init -q -b main
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -qm fixture
