| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-0.3-one-fix-round | 1 | 0.64 | 1.0 | 4.37 | 0.98 | 32.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |

## Failed checks

- chi-etag / lite-0.3-one-fix-round rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-0.3-one-fix-round rep: [process] subagents return the result template — gate returned 52 lines; gate returned 44 lines
- chi-etag / lite-0.3-one-fix-round rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-0.3-one-fix-round rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval--8xwzau9-workspace/2fe1c680-294b-4ba4-8ef9-de14e8b62c9f/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval--8xwzau9-workspace/2fe1c680-294b-4ba4-8ef9-de14e8b62c9f/scratchpad/criteria.md']
- chi-etag / lite-0.3-one-fix-round rep: [process] final report lists the agents that ran — final report names ['criteria_check'] of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
