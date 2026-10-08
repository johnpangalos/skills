#!/bin/bash
# checks.sh <part>: suite | types | format | order | changelog
set -u
case "$1" in
  suite)
    # one retry: a permutation-heavy upstream test times out when other runs load the machine
    log=$(mktemp)
    if pnpm vitest run packages/tailwindcss --retry=1 >"$log" 2>&1; then tail -4 "$log"; else grep -E "FAIL|Tests " "$log" | head -15; exit 1; fi ;;
  types)
    # the untouched repo already fails tsc on files that need the native oxide build, so only
    # errors in the files this feature touches count
    errs=$(cd packages/tailwindcss && pnpm exec tsc --noEmit 2>&1 | grep -E "^src/utilities(\.test)?\.ts" || true)
    if [ -n "$errs" ]; then echo "$errs" | head -10; exit 1; fi
    echo "no type errors in utilities.ts or utilities.test.ts" ;;
  format)
    files=$(git diff --name-only HEAD -- '*.ts' 'CHANGELOG.md'; git ls-files --others --exclude-standard -- '*.ts')
    [ -z "$files" ] && { echo "no changed files"; exit 1; }
    echo "$files" | xargs pnpm exec prettier --check 2>&1 | tail -5 ;;
  order)
    # new properties go into property-order.ts so the utilities sort next to related ones
    f=packages/tailwindcss/src/property-order.ts
    if grep -q "'anchor-name'" "$f" && grep -q "'position-anchor'" "$f"; then echo "both properties in property-order.ts"; else echo "anchor-name or position-anchor missing from property-order.ts"; exit 1; fi ;;
  changelog)
    python3 - <<'PY'
import re, sys
text = open("CHANGELOG.md").read()
unreleased = re.split(r"\n## \[(?!Unreleased)", text.split("## [Unreleased]", 1)[1])[0]
if not re.search(r"anchor", unreleased, re.I):
    sys.exit("no anchor entry under [Unreleased]")
print("changelog entry present")
PY
    ;;
esac
