#!/bin/bash
# setup_repo.sh <url> <commit>: check out a repo at a pinned commit into the current (empty) dir,
# then install its dependencies. Clones are cached under ~/.cache/ff-evals so later runs are fast.
set -euo pipefail
url=$1 commit=$2
name=$(basename "$url" .git)
cache="${FF_EVALS_CACHE:-$HOME/.cache/ff-evals}/$name"
if [ ! -d "$cache/.git" ]; then
  mkdir -p "$(dirname "$cache")"
  git clone -q --depth 50 "$url" "$cache"
fi
git -C "$cache" cat-file -e "$commit^{commit}" 2>/dev/null || git -C "$cache" fetch -q --depth 200 origin
git clone -q --no-checkout "$cache" .
git remote remove origin
git checkout -q -B main "$commit"
case "$name" in
  chi) go mod download ;;
  click) uv sync -q --frozen ;;
  fd)
    # seed target/ from a cached build so each run only recompiles fd itself
    [ -d "$cache.target" ] && cp -r "$cache.target" target
    cargo build -q --tests 2>/dev/null
    [ -d "$cache.target" ] || cp -r target "$cache.target" ;;
esac
