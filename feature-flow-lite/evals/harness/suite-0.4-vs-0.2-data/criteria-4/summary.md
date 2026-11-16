| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| discount-codes | lite-0.2-criteria | 3 | 0.81 | 1.0 | 0.91 | 0.97 | 15.33 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| rac-shadow-hide | lite-0.2-criteria | 3 | 0.67 | 0.94 | 1.56 | 0.93 | 24.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |

## Failed checks

- rac-shadow-hide / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL; reviewer missing GOAL; implementor missing GOAL
- rac-shadow-hide / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- rac-shadow-hide / lite-0.2-criteria rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-bvuqk9og-workspace/14298272-be06-4d06-b39b-87f859ff2412/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-bvuqk9og-workspace/14298272-be06-4d06-b39b-87f859ff2412/scratchpad/criteria.md']
- rac-shadow-hide / lite-0.2-criteria rep: [outcome] yarn.lock matches the package manifests — 5913a5914 | >     "@react-stately/flags": "npm:^3.1.2"
- rac-shadow-hide / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- rac-shadow-hide / lite-0.2-criteria rep: [process] subagents return the result template — investigator returned 56 lines
- rac-shadow-hide / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- rac-shadow-hide / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-qud7p1dw-workspace/0be888ac-a00e-4424-910f-c402426c8717/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-qud7p1dw-workspace/0be888ac-a00e-4424-910f-c402426c8717/scratchpad/criteria.md']
- rac-shadow-hide / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- rac-shadow-hide / lite-0.2-criteria rep: [process] subagents return the result template — reviewer returned 45 lines
- rac-shadow-hide / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- rac-shadow-hide / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- rac-shadow-hide / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval--0p7qzh2-workspace/6c9aa6d9-a75d-42bc-978d-395c49baa0db/scratchpad/criteria.md']
- discount-codes / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- discount-codes / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-sm6mth8a-workspace/faa9ccf4-0aeb-4e62-9c8c-2a6986a36c8a/scratchpad/criteria.md', '/tmp/ff-eval-sm6mth8a/workspace/shop/discounts.py', '/tmp/ff-eval-sm6mth8a/workspace/tests/test_discounts.py']
- discount-codes / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- discount-codes / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-1fpq818c-workspace/9cfeec47-3c1a-47bb-be98-1e54a9821b66/scratchpad/criteria.md']
- discount-codes / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- discount-codes / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- discount-codes / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-wwuuc2ir-workspace/258cd6c0-3c48-44c6-9a42-063e9b0616ec/scratchpad/criteria.md']
