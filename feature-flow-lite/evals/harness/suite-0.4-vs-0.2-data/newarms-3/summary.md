| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| ui-lib | lite-reviewer-plus | 5 | 0.71 | 1.0 | 1.58 | 0.87 | 25.2 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| ui-lib | lite-tests-first | 5 | 0.79 | 1.0 | 1.56 | 0.85 | 22.8 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, implementor:haiku/fm |

## Failed checks

- ui-lib / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 42 lines
- ui-lib / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-htbcuq6a-workspace/e01b22d6-e5d1-4aa4-b8ff-b9a41764a5bf/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-htbcuq6a-workspace/e01b22d6-e5d1-4aa4-b8ff-b9a41764a5bf/scratchpad/criteria.md', '/tmp/ff-eval-htbcuq6a/workspace/src/Tabs.test.tsx', '/tmp/ff-eval-htbcuq6a/workspace/src/Tabs.test.tsx', '/tmp/ff-eval-htbcuq6a/workspace/src/Tabs.tsx']
- ui-lib / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 62 lines; reviewer returned 49 lines
- ui-lib / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- ui-lib / lite-reviewer-plus rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- ui-lib / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-2i0c73o6-workspace/b75a234a-954f-4ca6-9d73-9c1338e9e0e2/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-2i0c73o6-workspace/b75a234a-954f-4ca6-9d73-9c1338e9e0e2/scratchpad/criteria.md', '/tmp/ff-eval-2i0c73o6/workspace/src/Combobox/Combobox.test.tsx']
- ui-lib / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 68 lines
- ui-lib / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-reviewer-plus rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- ui-lib / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-7s8kva4w-workspace/054ebce2-926b-4b73-990e-83c69464309c/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-7s8kva4w-workspace/054ebce2-926b-4b73-990e-83c69464309c/scratchpad/criteria.md', '/tmp/ff-eval-7s8kva4w/workspace/src/Tabs.tsx']
- ui-lib / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-nxf4w7gq-workspace/d79cc012-31ca-448c-8de4-b5f38411684f/scratchpad/criteria.md']
- ui-lib / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-tests-first rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- ui-lib / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-5dgunyey-workspace/f5983fde-4982-40fd-a165-3d8ce9f2c048/scratchpad/criteria.md']
- ui-lib / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-tests-first rep: [process] subagents return the result template — reviewer returned 41 lines
- ui-lib / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- ui-lib / lite-tests-first rep: [process] subagents return the result template — reviewer returned 46 lines
- ui-lib / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- ui-lib / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
