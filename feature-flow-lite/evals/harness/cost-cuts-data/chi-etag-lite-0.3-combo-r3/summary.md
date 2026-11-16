| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-0.3-combo | 1 | 0.79 | 1.0 | 3.09 | 0.97 | 25.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |

## Failed checks

- chi-etag / lite-0.3-combo rep: [process] handoff prompts use the template — gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-0.3-combo rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-0.3-combo rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
