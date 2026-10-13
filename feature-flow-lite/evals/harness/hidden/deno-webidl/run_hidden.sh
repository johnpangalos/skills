#!/bin/bash
# Copy the hidden tests into the core crate, run them, then put the workspace back.
set -uo pipefail
cp "$HIDDEN/zz_hidden_webidl.rs" core/zz_hidden_webidl.rs
cp core/lib.rs /tmp/zz_lib_backup.$$
printf '\n#[cfg(test)]\nmod zz_hidden_webidl;\n' >> core/lib.rs
out=$(cargo test -q -p deno_core --lib zz_hidden_webidl 2>&1)
status=$?
mv /tmp/zz_lib_backup.$$ core/lib.rs
rm -f core/zz_hidden_webidl.rs
echo "$out" | grep -E "^test |test result|error(\[E[0-9]+\])?:|panicked|FAILED" | head -60
exit $status
