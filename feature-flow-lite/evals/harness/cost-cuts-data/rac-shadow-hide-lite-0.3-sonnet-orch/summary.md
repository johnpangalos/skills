| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| rac-shadow-hide | lite-0.3-sonnet-orch | 1 | 0.71 | 1.0 | 4.1 | 0.75 | 33.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm |

## Failed checks

- rac-shadow-hide / lite-0.3-sonnet-orch rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- rac-shadow-hide / lite-0.3-sonnet-orch rep: [process] subagents return the result template — gate returned 43 lines
- rac-shadow-hide / lite-0.3-sonnet-orch rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-0.3-sonnet-orch rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
