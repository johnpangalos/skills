#!/bin/bash
# checks.sh <suite|ops|clippy|format|readme>: the repo's own checks for the deno-webidl scenario.
set -uo pipefail
case "$1" in
  # test_rebuild_async_stubs needs the deno CLI, which the eval container lacks; it fails on the base commit too
  suite) cargo test -q -p deno_core -p deno_ops -- --skip test_rebuild_async_stubs 2>&1 | grep -E "test result|FAILED|error(\[E[0-9]+\])?:|panicked" | tail -15; exit ${PIPESTATUS[0]} ;;
  ops) cargo test -q -p deno_ops_compile_test_runner 2>&1 | grep -E "test result|FAILED|error|mismatch" | tail -15; exit ${PIPESTATUS[0]} ;;
  clippy) cargo clippy -q -p deno_core -p deno_ops --all-targets -- -D warnings 2>&1 | tail -15; exit ${PIPESTATUS[0]} ;;
  format) cargo fmt --all -- --check 2>&1 | head -15; exit ${PIPESTATUS[0]} ;;
  readme) grep -qi "webidl" ops/op2/README.md ;;
esac
