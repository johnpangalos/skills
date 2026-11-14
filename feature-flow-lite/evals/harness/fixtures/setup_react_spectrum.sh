#!/bin/bash
# setup_react_spectrum.sh <commit>: check out adobe/react-spectrum at a pinned commit into the
# current (empty) dir, installed. The install is cached under ~/.cache/ff-evals/react-spectrum
# (about 1 GB). Tracked files are real copies, so edits never reach the cache; the ignored install
# output (node_modules, generated icons) is hardlinked from the cache, so a run costs almost no disk.
set -euo pipefail
commit=$1
cache="${FF_EVALS_CACHE:-$HOME/.cache/ff-evals}/react-spectrum"
if [ ! -d "$cache/.git" ] || [ "$(git -C "$cache" rev-parse HEAD)" != "$(git -C "$cache" rev-parse "$commit^{commit}" 2>/dev/null)" ]; then
  rm -rf "$cache" && mkdir -p "$cache"
  git -C "$cache" init -q
  git -C "$cache" fetch -q --depth 50 https://github.com/adobe/react-spectrum.git "$commit"
  git -C "$cache" checkout -q -B main FETCH_HEAD
  (cd "$cache" && node .yarn/releases/yarn-*.cjs install --immutable >/dev/null)
fi
git clone -q --no-checkout "$cache" .
git remote remove origin
git checkout -q -B main "$commit"
(cd "$cache" && git ls-files --others --ignored --exclude-standard --directory) | while IFS= read -r path; do
  path=${path%/}
  case "$path" in
    junit.xml) ;;
    .yarn/install-state.gz) cp -a "$cache/$path" "$path" ;;
    *) mkdir -p "$(dirname "$path")" && cp -al "$cache/$path" "$path" ;;
  esac
done
