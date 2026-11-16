| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| risky-refunds | lite-shipped-0.2 | 3 | 0.8 | 1.0 | 0.8 | 0.95 | 15.33 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| risky-refunds | lite-shipped-0.4 | 3 | 0.76 | 1.0 | 1.46 | 0.98 | 16.67 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm |
| website-bookshop | lite-shipped-0.2 | 3 | 0.79 | 1.0 | 1.17 | 0.86 | 21.0 | implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| website-bookshop | lite-shipped-0.4 | 3 | 0.76 | 1.0 | 2.84 | 0.98 | 15.67 | criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm |

## Failed checks

- website-bookshop / lite-shipped-0.2 rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-shipped-0.2 rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- website-bookshop / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-9465llfi/workspace/events.html']
- website-bookshop / lite-shipped-0.2 rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-shipped-0.2 rep: [process] subagents return the result template — reviewer returned 42 lines
- website-bookshop / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-shipped-0.2 rep: [process] handoff prompts use the template — simplifier missing GOAL
- website-bookshop / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- website-bookshop / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- website-bookshop / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'simplifier']
- website-bookshop / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- website-bookshop / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- website-bookshop / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- website-bookshop / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'simplifier']
- website-bookshop / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- website-bookshop / lite-shipped-0.4 rep: [process] checks pass before any review — 4 review(s) started with no check run after the last edit
- website-bookshop / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'simplifier']
- risky-refunds / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- risky-refunds / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku']
- risky-refunds / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- risky-refunds / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku']
- risky-refunds / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- risky-refunds / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku', 'haiku']
- risky-refunds / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- risky-refunds / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- risky-refunds / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
- risky-refunds / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- risky-refunds / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.4 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-rfmtimvu/workspace/tests/test_orders.py']
- risky-refunds / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
- risky-refunds / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL; gate missing GOAL; gate missing GOAL
- risky-refunds / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-refunds / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
