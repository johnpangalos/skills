#!/usr/bin/env bash
# feature-flow-lite check cache: makes (or reuses) a worktree of the base commit
# and gives it the main tree's ignored paths (node_modules, generated files,
# .venv) as links, so checks run there without an install.
#   bash ffcc-base.sh <root> <worktree> <base commit>
# A node_modules directory is mirrored entry by entry rather than linked whole:
# a package manager's workspace links in it (yarn, npm and pnpm workspaces) are
# relative links to the repo's own packages, and through a linked directory
# they would resolve to the main tree's edited copy, so the base check would
# see two copies of every package, or the edited code.
set -e
root=$1 wt=$2 base=$3
[ -d "$wt" ] || git -C "$root" worktree add -q --detach "$wt" "$base"

# link one entry of a node_modules directory: a relative symlink is copied as is
# (it resolves inside the worktree), an absolute one into the repo is pointed at
# the worktree, and anything else is linked to the main tree's copy
link_entry() {
  local src=$1 dst=$2 t
  [ -e "$dst" ] || [ -L "$dst" ] && return 0
  if [ -L "$src" ]; then
    t=$(readlink "$src")
    case $t in
      /*) case $t in "$root"/*) t=$wt/${t#"$root"/} ;; esac; ln -s "$t" "$dst" ;;
      *) cp -P "$src" "$dst" ;;
    esac
  else
    ln -s "$src" "$dst"
  fi
}

mirror_node_modules() {
  local src=$1 dst=$2 e s
  mkdir -p "$dst"
  for e in "$src"/* "$src"/.[!.]*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    case ${e##*/} in
      @*) [ -d "$e" ] && [ ! -L "$e" ] || { link_entry "$e" "$dst/${e##*/}"; continue; }
        mkdir -p "$dst/${e##*/}"
        for s in "$e"/*; do [ -e "$s" ] || [ -L "$s" ] && link_entry "$s" "$dst/${e##*/}/${s##*/}"; done ;;
      *) link_entry "$e" "$dst/${e##*/}" ;;
    esac
  done
}

cd "$root"
git ls-files --others --ignored --exclude-standard --directory | while IFS= read -r p; do
  p=${p%/}
  case "$p" in .claude|.claude/*|.git|.git/*) continue ;; esac
  [ -e "$wt/$p" ] || [ -L "$wt/$p" ] && continue
  mkdir -p "$wt/$(dirname "$p")"
  if [ "${p##*/}" = node_modules ] && [ -d "$root/$p" ] && [ ! -L "$root/$p" ]; then
    mirror_node_modules "$root/$p" "$wt/$p"
  else
    ln -s "$root/$p" "$wt/$p"
  fi
done
