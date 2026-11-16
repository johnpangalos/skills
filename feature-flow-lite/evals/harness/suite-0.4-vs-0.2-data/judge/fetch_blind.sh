#!/bin/bash
# fetch_blind.sh <branch>:<path-to-tarball> ...
# Pulls blind-copy tarballs from worker branches, extracts each under /tmp/ffj/<n>/,
# and links every task folder to /tmp/ffj/tasks/<task>. Run from inside the repo.
set -euo pipefail
mkdir -p /tmp/ffj/tasks
n=0
for spec in "$@"; do
  branch=${spec%%:*}; path=${spec#*:}; n=$((n+1))
  git fetch -q origin "$branch"
  mkdir -p /tmp/ffj/x$n
  git show "FETCH_HEAD:$path" | tar xz -C /tmp/ffj/x$n
  for d in /tmp/ffj/x$n/*/*/; do ln -sfn "$d" "/tmp/ffj/tasks/$(basename "$d")"; done
done
ls /tmp/ffj/tasks
