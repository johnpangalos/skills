| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-mount-routes | lite-shipped-0.2 | 3 | 0.79 | 1.0 | 0.83 | 0.91 | 14.67 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| chi-mount-routes | lite-shipped-0.4 | 3 | 0.88 | 1.0 | 0.83 | 0.99 | 11.67 | gate:opus/fm; investigator:haiku/fm, gate:opus/fm; investigator:haiku/fm, gate:opus/fm |
| click-duration | lite-shipped-0.2 | 3 | 0.79 | 1.0 | 1.2 | 0.95 | 20.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| click-duration | lite-shipped-0.4 | 3 | 0.81 | 1.0 | 1.89 | 0.98 | 17.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm |

## Failed checks

- chi-mount-routes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-mount-routes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-mount-routes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-mount-routes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-mount-routes / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-4ch2hyj5/workspace/tree.go', '/tmp/ff-eval-4ch2hyj5/workspace/tree_test.go']
- chi-mount-routes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-mount-routes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-mount-routes / lite-shipped-0.2 rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- chi-mount-routes / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-bks_5dhh/workspace/tree.go']
- chi-mount-routes / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: ['revie']
- chi-mount-routes / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL
- chi-mount-routes / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-mount-routes / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['gate', 'investigator']
- chi-mount-routes / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-duration / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- click-duration / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-duration / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-0htesdmb-workspace/39a6113d-a1f7-403c-97f1-9795d0ce4a1e/scratchpad/criteria.md']
- click-duration / lite-shipped-0.2 rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['implementor', 'investigator', 'reviewer', 'simplifier']
- click-duration / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- click-duration / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-duration / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- click-duration / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-duration / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-abtubz4v-workspace/2477ac27-6302-497c-9790-a40f0d65d2bc/scratchpad/criteria.md']
- click-duration / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- click-duration / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-duration / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- click-duration / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-duration / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- click-duration / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- click-duration / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-duration / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names ['criteria_check'] of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
