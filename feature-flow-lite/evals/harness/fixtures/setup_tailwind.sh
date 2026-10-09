#!/bin/bash
# check out tailwindcss at a pinned commit into the current (empty) dir and install deps.
# the clone and the pnpm store are cached under ~/.cache/ff-evals so runs after the first are fast.
set -euo pipefail
commit=fa81d69
cache="${FF_EVALS_CACHE:-$HOME/.cache/ff-evals}/tailwindcss"
if [ ! -d "$cache/.git" ]; then
  mkdir -p "$(dirname "$cache")"
  git clone -q --depth 50 https://github.com/tailwindlabs/tailwindcss.git "$cache"
fi
git -C "$cache" cat-file -e "$commit^{commit}" 2>/dev/null || git -C "$cache" fetch -q --depth 200 origin
git clone -q --no-checkout "$cache" .
git checkout -q -B main "$commit"
pnpm install --frozen-lockfile --ignore-scripts --prefer-offline >/dev/null
