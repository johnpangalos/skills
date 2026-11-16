| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-0.3-sonnet-repo-seat | 1 | 0.71 | 1.0 | 5.02 | 0.94 | 39.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:sonnet/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |

## Failed checks

- chi-etag / lite-0.3-sonnet-repo-seat rep: [setup] run waited for its subagents — 1 of 10 subagents still running when the run ended; re-run it
- chi-etag / lite-0.3-sonnet-repo-seat rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-0.3-sonnet-repo-seat rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-0.3-sonnet-repo-seat rep: [process] checks pass before any review — 3 review(s) started with no check run after the last edit
- chi-etag / lite-0.3-sonnet-repo-seat rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-zkssru53-workspace/52c57ba4-1147-4f1e-9d29-90eff593a44f/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-zkssru53-workspace/52c57ba4-1147-4f1e-9d29-90eff593a44f/scratchpad/panel-brief.md', '/tmp/claude-0/-tmp-ff-eval-zkssru53-workspace/52c57ba4-1147-4f1e-9d29-90eff593a44f/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-zkssru53-workspace/52c57ba4-1147-4f1e-9d29-90eff593a44f/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-zkssru53-workspace/52c57ba4-1147-4f1e-9d29-90eff593a44f/scratchpad/criteria.md']
