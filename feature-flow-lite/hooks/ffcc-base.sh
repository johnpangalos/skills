#!/usr/bin/env bash
# feature-flow-lite check cache: makes (or reuses) a worktree of the base commit
# and gives it the main tree's ignored paths (node_modules, generated files,
# .venv), so checks run there without an install.
#   bash ffcc-base.sh <root> <worktree> <base commit>
# Ignored paths are hard-linked copies, not symlinks: through a symlink, tools
# that follow real paths (TypeScript, node's resolver) land in the main tree and
# resolve the repo's own packages from there, so the base check sees the edited
# code or two copies of every package. A hard-linked copy costs no disk, and the
# relative symlinks in it (workspace links) resolve inside the worktree. Files a
# tool rewrites in place (incremental build info, lint caches) are left out, so a
# base run never writes into the main tree's copy. Across filesystems, where hard
# links are impossible, it falls back to a symlink.
# On macOS, without GNU cp, the copy is an APFS clone (cp -cR): copy-on-write,
# no disk cost, and symlinks stay symlinks.
set -e
root=$1 wt=$2 base=$3
if cp --version >/dev/null 2>&1; then linkcopy=(cp -al); else linkcopy=(cp -cR); fi
[ -d "$wt" ] || git -C "$root" worktree add -q --detach "$wt" "$base"

# rewritten in place by the tools that use them
inplace() {
  find "$1" \( -name '*.tsbuildinfo' -o -name '.eslintcache' -o -name '.stylelintcache' \
    -o \( -type d \( -name .cache -o -name .turbo -o -name .pytest_cache -o -name .mypy_cache -o -name .ruff_cache \) \) \) \
    -prune -print 2>/dev/null
}

cd "$root"
git ls-files --others --ignored --exclude-standard --directory | while IFS= read -r p; do
  p=${p%/}
  case "$p" in .claude|.claude/*|.git|.git/*) continue ;; esac
  [ -e "$wt/$p" ] || [ -L "$wt/$p" ] && continue
  case "${p##*/}" in *.tsbuildinfo|.eslintcache|.stylelintcache|.cache|.turbo|.pytest_cache|.mypy_cache|.ruff_cache) continue ;; esac
  mkdir -p "$wt/$(dirname "$p")"
  if "${linkcopy[@]}" "$root/$p" "$wt/$p" 2>/dev/null; then
    [ -d "$wt/$p" ] && [ ! -L "$wt/$p" ] && inplace "$wt/$p" | while IFS= read -r f; do rm -rf "$f"; done
  else
    rm -rf "$wt/$p"
    ln -s "$root/$p" "$wt/$p"
  fi
done
