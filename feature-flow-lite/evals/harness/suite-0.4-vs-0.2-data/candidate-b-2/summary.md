| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| ui-lib | lite-candidate-b | 3 | 0.79 | 0.92 | 1.87 | 0.79 | 18.33 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |

## Failed checks

- ui-lib / lite-candidate-b rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- ui-lib / lite-candidate-b rep: [process] subagents return the result template — reviewer returned 45 lines
- ui-lib / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-candidate-b rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-candidate-b rep: [process] subagents return the result template — reviewer returned 43 lines
- ui-lib / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-candidate-b rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-candidate-b rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- ui-lib / lite-candidate-b rep: [process] subagents return the result template — reviewer returned 48 lines
- ui-lib / lite-candidate-b rep: [outcome] hidden accessibility tests pass —       Tests  1 failed | 14 passed (15) |    Start at  17:21:19 |    Duration  1.59s (transform 108ms, setup 60ms, collect 234ms, tests 642ms, environment 396ms, prepare 63ms)
