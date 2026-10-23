#!/bin/sh
# Installs feature-flow-lite-codex for OpenAI Codex CLI, at user level: the
# skill in ~/.agents/skills/ and its four agents in $CODEX_HOME/agents/.
# Re-run it to update.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
skill="$HOME/.agents/skills/feature-flow-lite-codex"
agents="${CODEX_HOME:-$HOME/.codex}/agents"

rm -rf "$skill"
mkdir -p "$skill" "$agents"
cp "$here/SKILL.md" "$skill/"
cp -R "$here/templates" "$here/agents" "$skill/"
cp "$here"/agents/ff_*.toml "$agents/"

echo "Installed the skill in $skill and the agents in $agents."
echo "Start codex and ask for a change with \$feature-flow-lite-codex."
