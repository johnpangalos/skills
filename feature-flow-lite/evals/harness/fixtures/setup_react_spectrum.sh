#!/bin/bash
# setup_react_spectrum.sh <commit>: check out adobe/react-spectrum at a pinned commit into the
# current (empty) dir, installed. The install is cached under ~/.cache/ff-evals/react-spectrum
# (about 1 GB). Each run gets real copies of the tracked files and of the ignored install output
# (node_modules, generated icons). Not hardlinks: the repo's postinstall (patch-package, the icon
# build) rewrites files in node_modules in place, so a `yarn install` in one run would change the
# cache and every other run.
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
    *) mkdir -p "$(dirname "$path")" && cp -a "$cache/$path" "$path" ;;
  esac
done
