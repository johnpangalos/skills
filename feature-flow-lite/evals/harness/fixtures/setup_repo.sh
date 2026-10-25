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
git -C "$cache" cat-file -e "$commit^{commit}" 2>/dev/null || git -C "$cache" fetch -q --depth 1000 origin
git clone -q --no-checkout "$cache" .
git remote remove origin
git checkout -q -B main "$commit"
case "$name" in
  chi) go mod download 2>/dev/null ;;
  click) uv sync -q --frozen ;;
  fd)
    # seed target/ from a cached build so each run only recompiles fd itself
    [ -d "$cache.target" ] && cp -r "$cache.target" target
    cargo build -q --tests 2>/dev/null
    [ -d "$cache.target" ] || cp -r target "$cache.target" ;;
  playdate-game-01)
    # the hand-drawn character sheets live in a private bucket; placeholders of the same shape
    # let the unit specs, headless checks and playtests run (collision never reads the art)
    python3 "$(dirname "$0")/playdate/placeholder_art.py" .
    mise trust -q . >/dev/null 2>&1
    bun install --frozen-lockfile >/dev/null 2>&1
    MISE_YES=1 mise install >/dev/null 2>&1 || true ;;
esac
