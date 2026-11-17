| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-candidate-c | 3 | 0.79 | 0.93 | 1.93 | 0.88 | 18.33 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |

## Failed checks

- chi-etag / lite-candidate-c rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-etag / lite-candidate-c rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-candidate-c rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; implementor missing GOAL; reviewer missing GOAL; implementor missing GOAL; reviewer missing GOAL
- chi-etag / lite-candidate-c rep: [process] subagents return the result template — investigator returned 42 lines
- chi-etag / lite-candidate-c rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-candidate-c rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-tycqey8g-workspace/4ce9841a-851e-4efb-8e36-6ca9246b9c27/scratchpad/criteria.md']
- chi-etag / lite-candidate-c rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.126s | FAIL
- chi-etag / lite-candidate-c rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-etag / lite-candidate-c rep: [process] subagents return the result template — investigator returned 46 lines
- chi-etag / lite-candidate-c rep: [process] stages announced before the first spawn — stage words before first spawn: none
