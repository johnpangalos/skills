| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |
|---|---|---|---|---|---|---|---|---|
| fd-count | lite-0.2-criteria | 3 | 0.81 | 0.95 | 1.18 | 0.93 | 20.33 | investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; investigator:haiku/fm, criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm |
| ui-lib | lite-0.2-criteria | 3 | 0.64 | 1.0 | 1.63 | 0.91 | 24.67 | criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm; criteria_check:opus/fm, implementor:haiku/fm, simplifier:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm, reviewer:haiku/fm, implementor:haiku/fm |

## Failed checks

- ui-lib / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL
- ui-lib / lite-0.2-criteria rep: [process] subagents return the result template — reviewer returned 70 lines
- ui-lib / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- ui-lib / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-smj6ql7o-workspace/4cea9939-1a51-410e-a97f-7d14569e8cb0/scratchpad/criteria.md', '/tmp/ff-eval-smj6ql7o/workspace/src/Tabs/Tabs.tsx']
- ui-lib / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL
- ui-lib / lite-0.2-criteria rep: [process] subagents return the result template — criteria_check returned 46 lines; reviewer returned 45 lines
- ui-lib / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-47vdak4c-workspace/456fdc53-3a7e-4a73-848f-8925888de246/scratchpad/criteria.md']
- ui-lib / lite-0.2-criteria rep: [process] handoff prompts use the template — criteria_check missing GOAL; simplifier missing GOAL
- ui-lib / lite-0.2-criteria rep: [process] subagents return the result template — criteria_check returned 42 lines; reviewer returned 42 lines
- ui-lib / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- ui-lib / lite-0.2-criteria rep: [process] checks pass before any review — 1 review(s) started with no check run after the last edit
- ui-lib / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-czrktzdl-workspace/929b489f-8a9c-49c6-b066-0946a99af5d0/scratchpad/criteria.md']
- fd-count / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- fd-count / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
- fd-count / lite-0.2-criteria rep: [process] main conversation leaves edits to subagents — main conversation edited ['/tmp/claude-0/-tmp-ff-eval-bvxx5jlg-workspace/9601dec7-6b34-43ab-a02a-d5399dea510a/scratchpad/criteria.md', '/tmp/claude-0/-tmp-ff-eval-bvxx5jlg-workspace/9601dec7-6b34-43ab-a02a-d5399dea510a/scratchpad/criteria.md', '/tmp/ff-eval-bvxx5jlg/workspace/src/main.rs']
- fd-count / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- fd-count / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: ['inves']
- fd-count / lite-0.2-criteria rep: [outcome] hidden --count tests pass — ok   --max-results caps a large count |  | 2 failed
- fd-count / lite-0.2-criteria rep: [process] handoff prompts use the template — investigator missing GOAL; criteria_check missing GOAL; simplifier missing GOAL
- fd-count / lite-0.2-criteria rep: [process] subagents return the result template — investigator returned 41 lines
- fd-count / lite-0.2-criteria rep: [process] stages announced before the first spawn — stage words before first spawn: none
