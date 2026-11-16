| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| rac-shadow-hide | lite-0.3-sonnet-repo-seat | 1 | 0.64 | 1.0 | 6.27 | 0.94 | 48.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:sonnet/fm, gate:opus/fm |

## Failed checks

- rac-shadow-hide / lite-0.3-sonnet-repo-seat rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- rac-shadow-hide / lite-0.3-sonnet-repo-seat rep: [process] subagents return the result template — investigator returned 42 lines; gate returned 41 lines
- rac-shadow-hide / lite-0.3-sonnet-repo-seat rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-0.3-sonnet-repo-seat rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-0.3-sonnet-repo-seat rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-xb9cdoqi-workspace/918ac377-94cd-4328-a0fa-76d692e226a6/scratchpad/criteria.md']
