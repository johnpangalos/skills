| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| chi-mount-routes | lite-reviewer-plus | 2 | 0.82 | 1.0 | 0.82 | 0.91 | 13.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| chi-mount-routes | lite-tests-first | 2 | 0.82 | 1.0 | 0.88 | 0.91 | 15.5 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| discount-codes | lite-reviewer-plus | 2 | 0.88 | 1.0 | 0.73 | 0.96 | 13.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| discount-codes | lite-tests-first | 2 | 0.88 | 1.0 | 0.74 | 0.96 | 13.5 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| fd-count | lite-reviewer-plus | 2 | 0.86 | 0.86 | 0.91 | 0.92 | 18.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| fd-count | lite-tests-first | 2 | 0.86 | 0.93 | 0.93 | 0.9 | 17.0 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |
| tailwind-anchor | lite-reviewer-plus | 2 | 0.86 | 1.0 | 0.84 | 0.95 | 15.5 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| tailwind-anchor | lite-tests-first | 2 | 0.86 | 1.0 | 0.78 | 0.96 | 16.5 | investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |

## Failed checks

- discount-codes / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- discount-codes / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- discount-codes / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- discount-codes / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- discount-codes / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- discount-codes / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- discount-codes / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- chi-mount-routes / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-mount-routes / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-mount-routes / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-mount-routes / lite-reviewer-plus rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- chi-mount-routes / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-h5sih3b_/workspace/mux_test.go']
- chi-mount-routes / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- chi-mount-routes / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- chi-mount-routes / lite-tests-first rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-fqxvnx3m/workspace/tree.go']
- chi-mount-routes / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- chi-mount-routes / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- tailwind-anchor / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- tailwind-anchor / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- tailwind-anchor / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- tailwind-anchor / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- tailwind-anchor / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- tailwind-anchor / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- tailwind-anchor / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- tailwind-anchor / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- fd-count / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL; reviewer missing GOAL
- fd-count / lite-reviewer-plus rep: [outcome] hidden --count tests pass — ok   --max-results caps a large count |  | 2 failed
- fd-count / lite-reviewer-plus rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL
- fd-count / lite-reviewer-plus rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- fd-count / lite-reviewer-plus rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/ff-eval-kid153ox/workspace/doc/fd.1']
- fd-count / lite-reviewer-plus rep: [outcome] zsh completion lists --count (unprompted convention) — --count missing from contrib/completion/_fd
- fd-count / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- fd-count / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: none
- fd-count / lite-tests-first rep: [process] handoff prompts use the template — investigator missing GOAL; simplifier missing GOAL; reviewer missing GOAL
- fd-count / lite-tests-first rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- fd-count / lite-tests-first rep: [outcome] hidden --count tests pass — ok   --max-results caps a large count |  | 2 failed
