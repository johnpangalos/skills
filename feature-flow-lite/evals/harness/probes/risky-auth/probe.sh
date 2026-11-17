#!/bin/bash
# probe.sh <build dir>: prints "pass/total failing..." with the probes/keys.json id for risky-auth.
# token-race: the hidden forced-interleaving stress test (hidden/risky-auth/stress_auth.py), run
# from a copy of the build the same way the scenario's check runs it.
set -u; here=$(cd "$(dirname "$0")" && pwd); H="$here/../../hidden/risky-auth"
d=$(mktemp -d); cp -r "$1"/. "$d"
if (cd "$d" && python3 -m unittest discover -s "$H" -t "$H" -p stress_auth.py -q >/dev/null 2>&1); then
  echo "1/1"; else echo "0/1 token-race"; fi
rm -rf "${d:?}"
