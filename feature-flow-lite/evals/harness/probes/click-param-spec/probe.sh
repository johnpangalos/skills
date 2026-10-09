#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..."
set -u; HERE=$(cd "$(dirname "$0")" && pwd)
d=$(mktemp -d); cp -r "$1"/. "$d"
(cd "$d" && uv sync -q --frozen >/dev/null 2>&1)
out=$(cd "$d" && .venv/bin/python "$HERE/probe.py" "$d" 2>&1)
p=$(grep -c '^PASS' <<<"$out"); t=$(grep -c '^\(PASS\|FAIL\)' <<<"$out")
echo "$p/$t $(grep '^FAIL' <<<"$out" | cut -c6- | tr '\n' ' ') $(grep -v '^\(PASS\|FAIL\)' <<<"$out" | tail -1 | cut -c1-80)"
rm -rf "$d"
