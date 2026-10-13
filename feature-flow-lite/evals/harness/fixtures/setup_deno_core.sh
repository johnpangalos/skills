#!/bin/bash
# setup_deno_core.sh <commit>: deno_core at a pinned commit, with target/ seeded from a cached
# build (about 4 GB) so a run doesn't spend its first five minutes compiling V8 bindings.
set -euo pipefail
# A run's target/ grows to about 10 GB (debug, clippy and trybuild builds), so hold a new setup
# until fewer than FF_DENO_MAX_BUILDS runs hold one, whatever run.py's -j. The lock is held until
# this run's target/ exists, so two waiting setups can't both pass.
exec 9>/tmp/ff-deno-setup.lock
flock 9
while [ "$(ls -d /tmp/ff-eval-*/workspace/target 2>/dev/null | wc -l)" -ge "${FF_DENO_MAX_BUILDS:-2}" ]; do sleep 30; done
bash "$FIXTURES/setup_repo.sh" https://github.com/denoland/deno_core.git "$1"
mkdir target
# drop the tags and objects the clone brought along from later history, upstream's version of
# the feature among them
git tag -l | xargs -r git tag -d >/dev/null
git reflog expire --expire=now --all && git repack -a -d -q && git prune --expire=now
cache="${FF_EVALS_CACHE:-$HOME/.cache/ff-evals}/deno_core.target"
[ -d "$cache" ] && cp -a "$cache"/. target  # -a keeps the mtimes cargo fingerprints on
flock -u 9
cargo test -q -p deno_core -p deno_ops --no-run 2>/dev/null
[ -d "$cache" ] || cp -a target "$cache"
