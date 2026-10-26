#!/bin/bash
# run_spec.sh <hidden spec>: run one hidden Lua spec through a copy of tests/run.lua that loads only it
set -u
cp "$1" tests/zz_hidden_spec.lua
sed -E '/^dofile\("tests\/[a-z_]+_spec\.lua"\)/d' tests/run.lua > tests/zz_hidden_run.lua
# keep the runner's summary at the end: insert the hidden spec before the first line after the spec list
python3 - <<'PY'
import re
p='tests/zz_hidden_run.lua'; s=open(p).read()
anchor='Tuning.setGame(nil)\n'
s=s.replace(anchor, anchor+'dofile("tests/zz_hidden_spec.lua")\n',1)
open(p,'w').write(s)
PY
MISE_YES=1 "$(MISE_YES=1 mise which lua)" tests/zz_hidden_run.lua 2>&1 | tail -25
status=${PIPESTATUS[0]}
rm -f tests/zz_hidden_spec.lua tests/zz_hidden_run.lua
exit "$status"
