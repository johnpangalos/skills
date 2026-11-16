| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| click-param-spec | lite-0.2-criteria | 3 | 0.79 | 1.0 | 1.71 | 0.96 | 27.0 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| website-bookshop | lite-0.2-criteria | 3 | 0.71 | 1.0 | 1.72 | 0.89 | 32.0 | criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm |

## Failed checks

- website-bookshop / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL
- website-bookshop / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- website-bookshop / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-wt47enm5/workspace/tests/site.test.cjs']
- website-bookshop / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL
- website-bookshop / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-0.2-criteria rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- website-bookshop / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-2wm6cq07/workspace/css/styles.css', '/tmp/ff-eval-2wm6cq07/workspace/README.md', '/tmp/ff-eval-2wm6cq07/workspace/tests/home.test.mjs', '/tmp/ff-eval-2wm6cq07/workspace/css/styles.css', '/tmp/ff-eval-2wm6cq07/workspace/css/styles.css']
- website-bookshop / lite-0.2-criteria rep: [process] final report lists the agents that ran — final report names ['reviewer'] of ['criteria_check', 'implementor', 'reviewer', 'simplifier']
- website-bookshop / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL
- website-bookshop / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-0.2-criteria rep: [process] checks pass before any review — 2 review(s) started with no check run after the last edit
- click-param-spec / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- click-param-spec / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-param-spec / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-pl48m67m-workspace/7f405305-5559-4d3e-8c2c-8925ef6cbd40/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-pl48m67m-workspace/7f405305-5559-4d3e-8c2c-8925ef6cbd40/scratchpad/criteria.md']
- click-param-spec / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- click-param-spec / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- click-param-spec / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-xyd43dem-workspace/68a118e0-61e9-4519-9307-80ac0e1ca546/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-xyd43dem-workspace/68a118e0-61e9-4519-9307-80ac0e1ca546/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-xyd43dem-workspace/68a118e0-61e9-4519-9307-80ac0e1ca546/scratchpad/criteria.md', '/tmp/ff-eval-xyd43dem/workspace/src/click/core.py', '/tmp/ff-eval-xyd43dem/workspace/tests/test_deprecations.py']
- click-param-spec / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- click-param-spec / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- click-param-spec / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-5fllb22y-workspace/a91eb6c8-6dbf-45c2-9af6-10dee0264f8b/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-5fllb22y-workspace/a91eb6c8-6dbf-45c2-9af6-10dee0264f8b/scratchpad/criteria.md']
