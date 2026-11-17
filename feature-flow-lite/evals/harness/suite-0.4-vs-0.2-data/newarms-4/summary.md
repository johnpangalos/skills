| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| website-bookshop | lite-reviewer-plus | 5 | 0.76 | 1.0 | 1.06 | 0.84 | 17.0 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm |
| website-bookshop | lite-tests-first | 5 | 0.81 | 1.0 | 1.17 | 0.8 | 21.8 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |

## Failed checks

- website-bookshop / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-reviewer-plus rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- website-bookshop / lite-reviewer-plus rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['implementor', 'reviewer', 'simplifier']
- website-bookshop / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL; implementor missing GOAL; reviewer missing GOAL
- website-bookshop / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-reviewer-plus rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- website-bookshop / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-sk93gbia/workspace/js/main.js']
- website-bookshop / lite-reviewer-plus rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['implementor', 'reviewer', 'simplifier']
- website-bookshop / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- website-bookshop / lite-reviewer-plus rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- website-bookshop / lite-reviewer-plus rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- website-bookshop / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-mv-e9x3f-workspace/c64675ad-fb1b-4e3e-befa-7d8c152cb78c/scratchpad/criteria.md']
- website-bookshop / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- website-bookshop / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-g4ept48l/workspace/js/main.js', '/tmp/ff-eval-g4ept48l/workspace/js/main.js']
- website-bookshop / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL; reviewer missing GOAL
- website-bookshop / lite-tests-first rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['implementor', 'reviewer', 'simplifier']
- website-bookshop / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- website-bookshop / lite-tests-first rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['implementor', 'reviewer', 'simplifier']
- website-bookshop / lite-tests-first rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-tests-first rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
