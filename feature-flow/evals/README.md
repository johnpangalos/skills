# feature-flow evals

The skill makes three kinds of claim, and each needs a different test:

| Claim | How it's tested | Where |
|---|---|---|
| It fires on multi-file features and fixes, and not on one-liners, questions or reviews | `claude plugin eval` trigger cases with a `tool_used: Skill` grader | `triggers/` |
| The orchestrator follows its own rules: roster models, stage selection, handoff template, checks before review, 2-round cap, escalation | headless runs graded from the stream-json trace | `harness/` |
| It's cheaper than the alternative for the same correctness | the same scenarios with and without the skill, scored on hidden acceptance tests and on cost per model | `harness/` arms |

`claude plugin eval` covers the first claim well. It can't do the other two: it has no grader that runs commands after the agent finishes, so hidden tests are out, and it reports cost but not cost per model. The harness covers those.

## Trigger cases (`triggers/`)

There are eight cases: four that should fire the skill and four near-misses that shouldn't (a one-constant bump, a question, a branch review, and a design note with no implementation). Each case seeds the `shop` fixture repo through `scaffold.sh` and stops after eight turns, so a run checks only whether the skill was chosen. A bug-hunt prompt can investigate for a few turns before it reaches for the skill, so keep the cap generous.

```sh
cd feature-flow
claude plugin eval . --tag trigger --ablation none --scaffold --trust-plugin --no-publish --max-cost-usd 15
```

Pass `--ablation none` here, because a no-skill arm can never fire the skill. Runs execute in an isolated home directory, so other installed skills don't compete for the trigger. Expect about $0.50 per run on Opus. The default is three runs per case.

## Harness (`harness/`)

`run.py` copies `fixtures/shop` into a fresh temp git repo for each run and runs `claude -p` there with `--output-format stream-json --verbose --forward-subagent-text`. In the `skill` arm the skill folder loads with `--plugin-dir`, so its named agents load too, and the run invokes it as `/feature-flow:feature-flow`. That separates "does it behave" from "does it trigger". `grade.py` then reads the trace and runs the hidden checks against the workspace.

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
| `website-bookshop` | Greenfield site in plain HTML/CSS/JS. Checks pages, links, no network requests, accessibility basics, and a headless render at 360px with JS off. |
| `api-go-bookmarks` | Greenfield REST API in Go against a fixed contract. Checks build, vet and tests, CRUD, the 400/422/404 split, the tag filter, and 200 concurrent creates. |
| `cli-rust-spend` | Greenfield CLI in Rust against a fixed contract. Checks build and tests, exact totals, and that usage errors exit 2 and change nothing. |
| `tailwind-anchor` | Feature in tailwindlabs/tailwindcss (TypeScript): anchor-positioning utilities. Hidden vitest file, full package suite, tsc on touched files, Prettier, changelog. |
| `chi-etag` | Feature in go-chi/chi (Go): an ETag middleware. Hidden tests in their own package with `-race`, full suite, vet, gofmt, README table row. |
| `click-duration` | Feature in pallets/click (Python): a `Duration` parameter type. Hidden pytest file, full suite, strict mypy, ruff, changelog, docs. |
| `fd-count` | Feature in sharkdp/fd (Rust): `--count`. Black-box tests against the built binary, full suite, clippy, fmt, changelog, man page, and the zsh completion (a convention the prompt doesn't mention). |

The four feature scenarios clone the repo at a pinned commit through `fixtures/setup_repo.sh` (or `setup_tailwind.sh`), caching clones and builds under `~/.cache/ff-evals`. Each hidden folder holds a `reference.patch`; the hidden checks fail on the untouched repo and pass with it applied.

Process checks (`kind: process`) apply only to the skill arm. Outcome checks (hidden tests, `./check.sh`, untouched files, the final answer) apply to every arm. Every pipeline scenario also gets the generic rules in `grade.py:PIPELINE_RULES`: pinned models (an alias on the call, or a named agent's frontmatter), named agents used when they're loaded, roster models (taken from the model each subagent actually ran on), the handoff and result templates, stages announced before the first spawn, checks after the last edit and before each review, the 2-round cap, at most one debugger, nested verifiers awaited, no depth-limit refusals, and a final report that names the agents.

### Arms

`scenarios.json` defines these arms. All of them run the main session on Opus at medium effort, except `sonnet-solo` and `sonnet-planner`:

| Arm | What runs |
|---|---|
| `skill` | The working-tree skill, loaded as a plugin with its named agents |
| `skill-v0` | The skill as first committed (`ref: 0263562`), loaded as a bare project skill with no agents, so you can measure a change against it |
| `baseline` | No skill |
| `sonnet-solo` | No skill, with Sonnet as the main model |
| `skill-v1`, `lite`, `skill-haiku`, `lite-haiku` | v1 at its ref; feature-flow-lite; v2 and lite with every agent pinned to Haiku at high effort |
| `lite-haiku-medium-wo` | lite with Haiku agents at medium effort and the `write-once` implementor variant |
| `sonnet-planner` | Sonnet main session running lite with the `sonnet-planner` variant: an Opus `planner` agent writes the plan and acceptance criteria |

An arm can pin any git `ref`, load another skill `folder`, lay a variant's files over the skill (`variant`: `harness/variants/<name>/`, which can replace SKILL.md or add and replace agents), and pin every agent's model and effort (`agents`). The harness extracts that version of the skill folder with `git archive`. The skill's value claim is that `skill` matches `baseline` on outcomes for less money. Running `sonnet-solo` too answers whether the cheaper main model alone gets the same result.

### Gotchas

- Uninstall any user-level copy of feature-flow before running the baselines. Every run records the skills it loaded, and a run whose arm loaded the skill when it shouldn't have (or the reverse) fails the setup check.
- The harness strips session-scoped variables (`CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_CODE_SUBAGENT_MODEL`, …) so the calling session's model and effort don't leak into the runs, and it sets the spawn depth explicitly (3 unless the scenario says otherwise).
- Every run is capped with `--max-budget-usd`, and `run.py` prints the worst-case total before it starts. On Opus, one rep of everything with both arms usually costs a few dollars.
- One rep is a smoke test, not a result. Agents choose their stages freshly on each run, so compare arms at `-n 3` or more.

### Main thread vs subagents

```sh
python3 threads.py results/<batch> [results/<batch> ...]
```

`threads.py` splits each run's cost into the main thread and its subagents, and splits each of those into cache reads, cache writes, fresh input and output. It also reports the main thread's final context size, what one follow-up turn would cost to re-read it with a warm cache (within the main thread's one-hour TTL) and a cold one, and speed: wall-clock time, time spent waiting on the model, and summed subagent time. Runs that share a machine slow each other's local tool time (builds and test suites) more than their model time. Input and cache tokens come from each message's usage. Output tokens come from the run's per-model totals, because streamed events record output at the start of a message. The script's totals match the reported cost exactly.

### Blind quality judging

Hidden checks only tell you that a build works. To compare quality, anonymize a batch and judge it with the dynamic workflow in `judge.workflow.js`:

```sh
python3 prepare_blind.py /tmp/ff-judge results/<batch> [results/<batch> ...]   # shuffled letters, site screenshots, diffs for repo runs
```

Then ask Claude Code to run `judge.workflow.js` as a workflow, passing the challenges (`id`, `kind`, `prompt`, and the `builds` letters and dirs) as `args`. For a change in an existing repo use `kind: "feature"`, pass each build's `diff`, and give a `probe`: the commands to run in the inspector's copy and the edge cases to try. Blind copies leave out build output and virtualenvs, so probes should rebuild or re-sync first. One inspector per build builds it, runs it, probes edge cases, and scores it. One judge per challenge then reproduces every blocker and major defect the inspectors claimed and ranks the builds on a single scale. Unblind the results with `results/<batch>/blind-mapping.json`.

### Adding a scenario

Add an entry to `scenarios.json`. It needs a `prompt`, and can take an `overlay` (files copied over the fixture), a `setup` command, `risky`, `depth`, `budget_usd`, and a list of `checks`. A check is either `{"cmd": ...}`, which runs in the workspace with `$HIDDEN` pointing at `hidden/<id>/`, or `{"rule": ...}` naming a function in `grade.py`. Put any hidden tests in `hidden/<id>/`, and confirm that they fail on the untouched fixture and pass on a hand-written fix.
