| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-etag | lite-reviewer-plus | 5 | 0.76 | 0.8 | 1.33 | 0.91 | 19.8 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| chi-etag | lite-tests-first | 5 | 0.8 | 0.84 | 1.16 | 0.91 | 17.8 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm |

## Failed checks

- chi-etag / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- chi-etag / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 44 lines
- chi-etag / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-reviewer-plus rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.108s | FAIL
- chi-etag / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-etag / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-reviewer-plus rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.093s | FAIL
- chi-etag / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- chi-etag / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 41 lines
- chi-etag / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- chi-etag / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-flp71_w4/workspace/middleware/etag.go', '/tmp/ff-eval-flp71_w4/workspace/middleware/etag.go']
- chi-etag / lite-reviewer-plus rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.107s | FAIL
- chi-etag / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; implementor missing GOAL; reviewer missing GOAL; implementor missing GOAL
- chi-etag / lite-reviewer-plus rep: [process] subagents return the result template — reviewer returned 41 lines
- chi-etag / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-io9eyokf-workspace/9ad62164-191e-41ff-913c-f1668127547c/scratchpad/criteria.md']
- chi-etag / lite-reviewer-plus rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.107s | FAIL
- chi-etag / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-etag / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-o8lsryxp-workspace/9a0262b1-6fcc-4b6e-8512-5496c40f1a9f/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-o8lsryxp-workspace/9a0262b1-6fcc-4b6e-8512-5496c40f1a9f/scratchpad/criteria.md', '/tmp/ff-eval-o8lsryxp/workspace/middleware/etag.go']
- chi-etag / lite-reviewer-plus rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.112s | FAIL
- chi-etag / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- chi-etag / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-p7kq4yif-workspace/74d1f944-c8d3-433c-a3e3-6ede1b79bc6b/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-p7kq4yif-workspace/74d1f944-c8d3-433c-a3e3-6ede1b79bc6b/scratchpad/criteria.md', '/tmp/ff-eval-p7kq4yif/workspace/middleware/etag.go']
- chi-etag / lite-tests-first rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.091s | FAIL
- chi-etag / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-etag / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-gi63dkm2/workspace/middleware/etag.go']
- chi-etag / lite-tests-first rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.087s | FAIL
- chi-etag / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; implementor missing GOAL
- chi-etag / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-w7391v_j/workspace/middleware/etag.go']
- chi-etag / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-etag / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-etag / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-idldo04y-workspace/6851e853-3a0e-476b-8ed4-6001fbdf17f2/scratchpad/criteria.md']
- chi-etag / lite-tests-first rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.108s | FAIL
- chi-etag / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-etag / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-etag / lite-tests-first rep: [outcome] hidden ETag tests pass (with -race) — FAIL | FAIL	github.com/go-chi/chi/v5/middleware/etaghidden	0.086s | FAIL
