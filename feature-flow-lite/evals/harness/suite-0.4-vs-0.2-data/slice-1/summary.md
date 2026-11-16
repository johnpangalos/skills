| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| discount-codes | lite-shipped-0.2 | 3 | 0.85 | 1.0 | 0.71 | 0.96 | 13.67 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| discount-codes | lite-shipped-0.4 | 3 | 0.79 | 1.0 | 0.86 | 0.99 | 9.33 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm; none |
| rac-shadow-hide | lite-shipped-0.2 | 3 | 0.76 | 0.94 | 1.14 | 0.92 | 19.33 | investigator:haiku/fm, implementor:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| rac-shadow-hide | lite-shipped-0.4 | 3 | 0.74 | 0.94 | 3.59 | 0.97 | 24.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm |

## Failed checks

- rac-shadow-hide / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; implementor missing GOAL; reviewer missing GOAL; implementor missing GOAL
- rac-shadow-hide / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-shipped-0.2 rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- rac-shadow-hide / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- rac-shadow-hide / lite-shipped-0.2 rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-wd5ll21p/workspace/packages/@react-aria/overlays/src/ariaHideOutside.ts', '/tmp/ff-eval-wd5ll21p/workspace/packages/@react-aria/overlays/test/ariaHideOutside.test.js']
- rac-shadow-hide / lite-shipped-0.2 rep: [outcome] type check is clean — node_modules/@mdx-js/react/lib/index.d.ts(1,9): error TS2300: Duplicate identifier 'JSX'. | node_modules/@mdx-js/react/lib/index.d.ts(2,9): error TS2300: Duplicate identifier 'JSX'.
- rac-shadow-hide / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- rac-shadow-hide / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- rac-shadow-hide / lite-shipped-0.2 rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- rac-shadow-hide / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-shipped-0.4 rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- rac-shadow-hide / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- rac-shadow-hide / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- rac-shadow-hide / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-shipped-0.4 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-s_l7spw_/workspace/packages/@react-aria/overlays/src/ariaHideOutside.ts']
- rac-shadow-hide / lite-shipped-0.4 rep: [outcome] type check is clean — node_modules/@mdx-js/react/lib/index.d.ts(1,9): error TS2300: Duplicate identifier 'JSX'. | node_modules/@mdx-js/react/lib/index.d.ts(2,9): error TS2300: Duplicate identifier 'JSX'.
- discount-codes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- discount-codes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- discount-codes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- discount-codes / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval--m5j75df-workspace/96387a24-9083-4db6-a9e3-5b722b2a2d61/scratchpad/criteria.md', '/tmp/ff-eval-_m5j75df/workspace/shop/discounts.py', '/tmp/ff-eval-_m5j75df/workspace/tests/test_discounts.py']
- discount-codes / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- discount-codes / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-shipped-0.4 rep: [process] a reviewer ran — 0 reviewer spawns
- discount-codes / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- discount-codes / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- discount-codes / lite-shipped-0.4 rep: [process] a reviewer ran — 0 reviewer spawns
- discount-codes / lite-shipped-0.4 rep: [process] a reviewer checked the result — 0 reviewer or looker or gate spawns
- discount-codes / lite-shipped-0.4 rep: [process] investigator runs before implementor — investigator: 0, implementor: 0
- discount-codes / lite-shipped-0.4 rep: [process] a reviewer ran — 0 reviewer spawns
