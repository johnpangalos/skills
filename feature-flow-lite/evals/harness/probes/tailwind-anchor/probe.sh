#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json ids for tailwind-anchor.
set -u; here=$(cd "$(dirname "$0")" && pwd)
d=$(mktemp -d); cp -r "$1"/. "$d"
[ -d "$d/node_modules" ] || (cd "$d" && pnpm install --frozen-lockfile --ignore-scripts --prefer-offline >/dev/null 2>&1)
t=packages/tailwindcss/src/zz_anchor.probe.test.ts; cp "$here/anchor.probe.test.ts" "$d/$t"
out=$(cd "$d" && pnpm vitest run --reporter=verbose "$t" 2>&1)
total=$(grep -c "^test('" "$here/anchor.probe.test.ts")
pass=$(grep -cE '^ +✓ .*zz_anchor.probe.test.ts > ' <<<"$out")
fails=$(grep -oE '^ +(×|✗) .*zz_anchor.probe.test.ts > [a-z-]+' <<<"$out" | sed -E 's/.* > //' | tr '\n' ' ')
[ $((pass + $(wc -w <<<"$fails"))) -ne "$total" ] && fails="$fails probe-error"
[ -n "${PROBE_DEBUG:-}" ] && echo "$out" >&2
echo "$pass/$total $fails"; rm -rf "${d:?}"
