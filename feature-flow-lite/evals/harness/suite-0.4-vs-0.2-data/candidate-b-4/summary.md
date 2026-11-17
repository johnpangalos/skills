| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| click-param-spec | lite-candidate-b | 3 | 0.79 | 1.0 | 1.33 | 0.91 | 19.33 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| fd-count | lite-candidate-b | 3 | 0.86 | 1.0 | 0.91 | 0.89 | 14.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |

## Failed checks

- click-param-spec / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- click-param-spec / lite-candidate-b rep: [process] subagents return the result template — investigator returned 46 lines
- click-param-spec / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-param-spec / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; implementor missing GOAL; reviewer missing GOAL; implementor missing GOAL
- click-param-spec / lite-candidate-b rep: [process] subagents return the result template — investigator returned 51 lines
- click-param-spec / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-param-spec / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- click-param-spec / lite-candidate-b rep: [process] subagents return the result template — investigator returned 46 lines
- click-param-spec / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- fd-count / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- fd-count / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- fd-count / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- fd-count / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: none
- fd-count / lite-candidate-b rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; implementor missing GOAL
- fd-count / lite-candidate-b rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
