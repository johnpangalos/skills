#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json id for risky-refunds.
# refund-race: the hidden forced-interleaving stress test (hidden/risky-refunds/stress_refunds.py), run
# from a copy of the build the same way the scenario's check runs it.
set -u; here=$(cd "$(dirname "$0")" && pwd); H="$here/../../hidden/risky-refunds"
d=$(mktemp -d); cp -r "$1"/. "$d"
if (cd "$d" && python3 -m unittest discover -s "$H" -t "$H" -p stress_refunds.py -q >/dev/null 2>&1); then
  echo "1/1"; else echo "0/1 refund-race"; fi
rm -rf "${d:?}"
