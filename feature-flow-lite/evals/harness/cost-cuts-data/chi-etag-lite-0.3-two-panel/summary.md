| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-0.3-two-panel | 1 | 0.79 | 1.0 | 6.03 | 0.94 | 46.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm |

## Failed checks

- chi-etag / lite-0.3-two-panel rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-0.3-two-panel rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-0.3-two-panel rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-c4reo0mk-workspace/3e1071f9-7cd2-4186-979d-41cc68836e75/scratchpad/criteria.md', '/tmp/ff-eval-c4reo0mk/workspace/middleware/etag.go', '/tmp/claude-0/-tmp-ff-eval-c4reo0mk-workspace/3e1071f9-7cd2-4186-979d-41cc68836e75/scratchpad/criteria.md', '/tmp/ff-eval-c4reo0mk/workspace/middleware/etag.go']
