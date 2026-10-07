# feature-flow evals

The skill makes three kinds of claim, and each needs a different test:

| Claim | How it's tested | Where |
|---|---|---|
| It fires on multi-file features and fixes, and not on one-liners, questions or reviews | `claude plugin eval` trigger cases with a `tool_used: Skill` grader | `triggers/` |
| The orchestrator follows its own rules: roster models, stage selection, handoff template, checks before review, 2-round cap, escalation | headless runs graded from the stream-json trace | `harness/` |
| It's cheaper than the alternative for the same correctness | the same scenarios with and without the skill, scored on hidden acceptance tests and on cost per model | `harness/` arms |

`claude plugin eval` covers the first claim well. It can't do the other two: it has no grader that runs commands after the agent finishes, so hidden tests are out, and it reports cost but not cost per model. The harness covers those.

## Trigger cases (`triggers/`)

There are eight cases: four that should fire the skill and four near-misses that shouldn't (a one-constant bump, a question, a branch review, and a design note with no implementation). Each case seeds the `shop` fixture repo through `scaffold.sh` and stops after four turns, so a run checks only whether the skill was chosen.

```sh
cd feature-flow
claude plugin eval . --tag trigger --ablation none --scaffold --trust-plugin --no-publish --max-cost-usd 15
```

Pass `--ablation none` here, because a no-skill arm can never fire the skill. Runs execute in an isolated home directory, so other installed skills don't compete for the trigger. Expect about $0.50 per run on Opus. The default is three runs per case.

## Harness (`harness/`)

`run.py` copies `fixtures/shop` into a fresh temp git repo for each run and runs `claude -p` there with `--output-format stream-json --verbose --forward-subagent-text`. In the `skill` arm the skill is installed as a project skill and invoked with `/feature-flow`, which separates "does it behave" from "does it trigger". `grade.py` then reads the trace and runs the hidden checks against the workspace.

```sh
cd feature-flow/evals/harness
python3 run.py --dry-run                                  # show the commands
python3 run.py -s discount-codes -a skill,baseline -n 3 -j 3
python3 run.py                                            # every scenario, skill + baseline
python3 grade.py results/<ts>/<scenario>/<arm>/rep-1 <scenario>   # re-grade one run
```

Each run writes `trace.jsonl`, `diff.patch`, `meta.json`, and a `grading.json` in skill-creator's shape (`expectations[].text/passed/evidence`). Each batch also writes a `summary.md` that compares arms on outcome pass rate, cost, Opus share of cost, and which agents ran on which model and effort. The fixture repo lives in `/tmp` until you delete it, and outcome checks need it to re-grade.

### Scenarios

| id | What it pins down |
|---|---|
| `discount-codes` | Typical multi-file feature. Checks investigator → implementor → checks → reviewer, roster models, and the template. It has a trap: the receipt needs `-$4.33`, but `format_money` prints `$-4.33`. |
| `discount-codes-depth1` | The same task with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, which some cloud sessions set. Subagents don't get the Agent tool, so the implementor can't spawn its verifier. |
| `negative-money` | One-file tweak. Checks for no investigator, no reviewer, and at most 2 agents. |
| `reset-token-expiry` | Risky area (auth). Checks for a reviewer on opus, a security reviewer, and that the opus step is announced before it runs. |
| `rounding-conflict` | The two rounding tests contradict each other and `tests/` is off-limits. The run passes only if it stops and reports, with no special-cased hack and the fix loop within its cap. |
| `sql-audit` | 2,400 generated files. Checks for no pipeline, no edits, and a dynamic-workflow recommendation with all four caveats. |
| `shipping-question` | Pure question. Checks for at most one explorer, no edits, and a correct answer. |

Process checks (`kind: process`) apply only to the skill arm. Outcome checks (hidden tests, `./check.sh`, untouched files, the final answer) apply to every arm. Every pipeline scenario also gets the generic rules in `grade.py:PIPELINE_RULES`: pinned model aliases, roster models, the handoff and result templates, stages announced before the first spawn, checks after the last edit and before each review, the 2-round cap, at most one debugger, nested verifiers awaited, no depth-limit refusals, and a final report that names the agents.

### Arms

`scenarios.json` defines `skill` (Opus at medium effort, with the skill), `baseline` (Opus at medium effort, without it) and `sonnet-solo` (Sonnet, without it). The skill's value claim is that `skill` matches `baseline` on outcomes for less money. Running `sonnet-solo` too answers whether the cheaper main model alone gets the same result.

### Gotchas

- Uninstall any user-level copy of feature-flow before running the baselines. Every run records the skills it loaded, and a run whose arm loaded the skill when it shouldn't have (or the reverse) fails the setup check.
- The harness strips session-scoped variables (`CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_CODE_SUBAGENT_MODEL`, …) so the calling session's model and effort don't leak into the runs, and it sets the spawn depth explicitly (3 unless the scenario says otherwise).
- Every run is capped with `--max-budget-usd`, and `run.py` prints the worst-case total before it starts. On Opus, one rep of everything with both arms usually costs a few dollars.
- One rep is a smoke test, not a result. Agents choose their stages freshly on each run, so compare arms at `-n 3` or more.

### Adding a scenario

Add an entry to `scenarios.json`. It needs a `prompt`, and can take an `overlay` (files copied over the fixture), a `setup` command, `risky`, `depth`, `budget_usd`, and a list of `checks`. A check is either `{"cmd": ...}`, which runs in the workspace with `$HIDDEN` pointing at `hidden/<id>/`, or `{"rule": ...}` naming a function in `grade.py`. Put any hidden tests in `hidden/<id>/`, and confirm that they fail on the untouched fixture and pass on a hand-written fix.
