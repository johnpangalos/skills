| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| ui-lib | lite-shipped-0.2 | 2 | 0.71 | 1.0 | 1.35 | 0.89 | 21.5 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| ui-lib | lite-shipped-0.4 | 2 | 0.71 | 0.75 | 3.42 | 0.96 | 20.0 | criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |

## Failed checks

- ui-lib / lite-shipped-0.2 rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- ui-lib / lite-shipped-0.2 rep: [process] subagents return the result template — reviewer returned 63 lines; reviewer returned 57 lines
- ui-lib / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-shipped-0.2 rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- ui-lib / lite-shipped-0.2 rep: [process] subagents return the result template — reviewer returned 53 lines
- ui-lib / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-shipped-0.2 rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- ui-lib / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-2h6g03py-workspace/810f2073-d062-4971-8f38-5b5e9f6c1eb9/scratchpad/criteria.md', '/tmp/ff-eval-2h6g03py/workspace/README.md']
- ui-lib / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- ui-lib / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- ui-lib / lite-shipped-0.4 rep: [process] checks pass before any review — 3 review(s) started with no check run after the last edit
- ui-lib / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'simplifier']
- ui-lib / lite-shipped-0.4 rep: [outcome] hidden accessibility tests pass —       Tests  1 failed | 14 passed (15) |    Start at  07:15:01 |    Duration  1.40s (transform 113ms, setup 64ms, collect 240ms, tests 540ms, environment 321ms, prepare 57ms)
- ui-lib / lite-shipped-0.4 rep: [process] subagents return the result template — criteria_check returned 44 lines
- ui-lib / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- ui-lib / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- ui-lib / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names ['simplifier'] of ['criteria_check', 'gate', 'implementor', 'simplifier']
- ui-lib / lite-shipped-0.4 rep: [outcome] hidden accessibility tests pass —       Tests  2 failed | 13 passed (15) |    Start at  07:15:14 |    Duration  1.48s (transform 114ms, setup 86ms, collect 217ms, tests 572ms, environment 365ms, prepare 61ms)
