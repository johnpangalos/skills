| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-shipped-0.2 | 3 | 0.83 | 0.8 | 1.12 | 0.93 | 17.33 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| chi-etag | lite-shipped-0.4 | 3 | 0.79 | 1.0 | 2.76 | 0.97 | 22.67 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |
| risky-inventory | lite-shipped-0.2 | 3 | 0.76 | 1.0 | 0.66 | 0.96 | 13.33 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| risky-inventory | lite-shipped-0.4 | 3 | 0.78 | 1.0 | 1.25 | 0.98 | 11.67 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm; implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, gate:opus/fm, gate:opus/fm, gate:opus/fm, implementor:haiku/fm, gate:opus/fm, implementor:haiku/fm |

## Failed checks

- chi-etag / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-etag / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-shipped-0.2 rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.132s | FAIL
- chi-etag / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- chi-etag / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-shipped-0.2 rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.122s | FAIL
- chi-etag / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-etag / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-6tcpnruv-workspace/08263edc-1c45-4c44-89bb-9c4d9413b9a0/scratchpad/criteria.md']
- chi-etag / lite-shipped-0.2 rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.102s | FAIL
- chi-etag / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- chi-etag / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- chi-etag / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- chi-etag / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names no roles of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- risky-inventory / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- risky-inventory / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-au37uco9/workspace/tests/test_inventory.py']
- risky-inventory / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku']
- risky-inventory / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- risky-inventory / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku']
- risky-inventory / lite-shipped-0.2 rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- risky-inventory / lite-shipped-0.2 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.2 rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-njpl57zg/workspace/README.md']
- risky-inventory / lite-shipped-0.2 rep: [process] reviewer models (for the record) — reviewer models: ['haiku']
- risky-inventory / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- risky-inventory / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
- risky-inventory / lite-shipped-0.4 rep: [process] handoff prompts use the template — gate missing GOAL
- risky-inventory / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
- risky-inventory / lite-shipped-0.4 rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL; gate missing GOAL
- risky-inventory / lite-shipped-0.4 rep: [process] stages announced before the first spawn — stage words before first spawn: none
- risky-inventory / lite-shipped-0.4 rep: [process] final report lists the agents that ran — final report names ['criteria_check'] of ['criteria_check', 'gate', 'implementor', 'investigator', 'simplifier']
- risky-inventory / lite-shipped-0.4 rep: [process] reviewer models (for the record) — reviewer models: not spawned
