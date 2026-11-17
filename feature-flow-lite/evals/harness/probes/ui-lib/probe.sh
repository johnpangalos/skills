#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json ids for ui-lib.
set -u; here=$(cd "$(dirname "$0")" && pwd)
d=$(mktemp -d); cp -r "$1"/. "$d"; rm -rf "$d/node_modules"
(cd "$d" && pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1)
mkdir -p "$d/tests"; cp "$here/probe.test.tsx" "$d/tests/zz_probe.test.tsx"
out=$(cd "$d" && npx vitest run --reporter=verbose tests/zz_probe.test.tsx 2>&1)
total=$(grep -c '^  test("' "$here/probe.test.tsx")
pass=$(grep -cE '^ +✓ .*probes > ' <<<"$out")
fails=$(grep -oE '^ +(×|✗) .*probes > [a-z-]+' <<<"$out" | sed -E 's/.*probes > //' | tr '\n' ' ')
[ "$pass" -eq 0 ] && [ -z "$fails" ] && fails="probe-error"
[ -n "${PROBE_DEBUG:-}" ] && echo "$out" >&2
echo "$pass/$total $fails"; rm -rf "${d:?}"
