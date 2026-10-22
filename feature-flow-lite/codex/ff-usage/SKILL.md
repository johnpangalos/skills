---
name: ff-usage
description: Use only when the user asks for ff-usage or for feature-flow-lite's per-role token and time usage. Prints the table for the latest feature-flow-lite session in this repo.
---

# ff-usage

Run this from the repo root and show its output to the user exactly as printed, in a code block,
with nothing added:

```sh
node "{{HOOKS}}" usage "$PWD"
```

Token columns show `-` when Codex's transcript gave the hooks no token counts. The orchestrator's
row is its running total at the end of its last turn.
