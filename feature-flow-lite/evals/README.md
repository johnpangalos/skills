# feature-flow-lite evals

The skill makes three kinds of claim, and each needs a different test:

| Claim | How it's tested | Where |
|---|---|---|
| It fires on multi-file features and fixes, and not on one-liners, questions or reviews | `claude plugin eval` trigger cases with a `tool_used: Skill` grader | `triggers/` |
| The orchestrator follows its own rules: roster models, stage selection, handoff template, checks before review, 2-round cap, escalation | headless runs graded from the stream-json trace | `harness/` |
| It's cheaper than the alternative for the same correctness | the same scenarios with and without the skill, scored on hidden acceptance tests and on cost per model | `harness/` arms |

`claude plugin eval` covers the first claim well. It can't do the other two: it has no grader that runs commands after the agent finishes, so hidden tests are out, and it reports cost but not cost per model. The harness covers those.

## Results so far

A summary of every eval run on feature-flow-lite and its Figma offshoots so far (also as a page: https://claude.ai/artifact/Rp6rjf1Kat6uqSC6LMBud1). Unless a section says otherwise, every build was judged blind: one inspector per build, then two independent judges per task ranking all of that task's builds on one 1–10 scale. Every skill setup runs the main session on Opus at medium effort. Scores from different judging passes aren't comparable, so each table below compares setups only within itself.

### The short version

- **The orchestrator is the product.** Opus writing the acceptance criteria is what earns the score. Swapping the subagents from Haiku to Sonnet or Opus didn't move it, and Opus agents doubled the cost.
- **What shipped, and why:**
  - Haiku agents.
  - Sibling criteria and hostile inputs (v3): best correctness, robustness and tests sub-scores, but no measurable change in the judged score.
  - One red-team reviewer (v5): the first change with a large gain on a task it wasn't written against.
  - The mod (handoff guard, tests check, `/ff-usage`): costs nothing and catches dropped criteria, but doesn't measurably raise quality.
  - The per-repo `FEATURE_FLOW.md`: beat v5 + mod on all three tasks, by 0.6 on average, at about 24% more cost.
- **What didn't ship:**
  - v4's extra rules: overfit to the benchmark tasks.
  - More reviewers (v6, v7): cost more without a reliable gain.
  - Opus triage of findings (v8): twice the cost, and the gain vanished on a held-out site.
  - The article learnings plus a screenshot reviewer (v9): no better than v5, and it stopped writing tests for websites.
- **What was removed:** the Opus reviewer on risky paths. On 30 builds of auth, payments and concurrency tasks, a Haiku reviewer matched it on every hidden case for 21% less. Haiku also reproduced the token and refund races itself.
- **On websites, plain Opus still builds the best-looking product**, but it barely tests it. That pattern holds on every task so far.
- **For Figma component work the pipeline doesn't pay.** With an exact-value test in the repo, plain Opus or plain Sonnet matched every value at a fraction of the cost. figma-flow now builds directly.
- **Noise is large.** About 0.9 points of spread per build means 3 builds per setup can only show gains of roughly half a point or more. Several early leads disappeared on a re-run.

### Timeline

| Round | Question | Answer | Shipped? |
|---|---|---|---|
| 1–4 | Does a capped subagent pipeline beat plain Opus? | Lite with Haiku agents scored highest for the least money (round 4: 7.9 against 7.7). | Yes, as feature-flow-lite |
| 5 | Do stronger subagents help? | No. Haiku 7.55, Opus 7.45, Sonnet 7.29, plain Opus 7.32; Opus agents doubled the cost. | Kept Haiku |
| v3 | Sibling criteria and hostile inputs | Tied the shipped skill (7.56 against 7.55), led on one unseen task. | Yes |
| v4 | Wrapper rules, full checks, Opus final read | 8.04 on the benchmark, but tied v3 on unseen tasks. | No (overfit) |
| v5 | Red-team reviewer | 8.00 against at most 6.83 on the component library. | Yes |
| v6, v7 | Three Haiku reviewers | Same average, more cost; v7 swung both ways. | No |
| v8 | Smoke-first review with Opus triage | Best on tuned tasks, tied v5 on the held-out site, 2× cost. | No |
| v9 | Article learnings plus a screenshot reviewer | 7.36 against 7.51 for v5; website tests collapsed. | No |
| Mod | Handoff guard, tests check, usage log | 7.31 against 7.00 on 6 website builds each; the gap is one broken build. | Yes (PR #6) |
| Project file | Per-repo `FEATURE_FLOW.md` | 7.98 against 7.37 for v5 + mod, ahead on all three tasks. | Yes (PR #7) |
| Figma | Pipeline vs plain model on Button and Tabs | Plain Opus and Sonnet passed everything for a quarter of the cost or less. | figma-flow builds directly (PR #10) |
| Opus reviewer | Does moving the reviewer to Opus on risky paths pay? | No. Both arms passed every hidden case in 30 of 30 builds; Opus cost 27% more. | Removed |

### Earlier rounds (1–5)

Round 4 is the only early round run on the released skill and this harness. Its raw results (traces, diffs, gradings, cost split, judging reports and trigger evals) are attached to the `feature-flow-lite-v1` release as `feature-flow-lite-benchmark-round4.tar.gz`, and the earlier full report is at https://claude.ai/artifact/DndzbF6C6S6GTzvykA9RQs. Rounds 1–3 tested earlier skill versions and are kept only as summaries:

| Round | Tasks | Finding |
|---|---|---|
| 1 | website, Go API, Rust CLI | v1 (named agents) scored 6.5 against plain Opus's 6.8 and cost more; its reviewer passed every build. |
| 2 | the same three plus Tailwind; six arms | A reviewer checklist and written acceptance criteria lifted v2 and lite; lite with Haiku agents scored highest (8.0) for the least money ($0.52). |
| 3 | features in Tailwind, chi, click, fd | Lite with Haiku agents beat plain Opus in every repo (7.9 against 7.4); a Sonnet orchestrator with an Opus planner cost the most. |
| 4 | round 3's features with stronger checks, plus a chi bug hunt and a click cross-module change | The shipped lite scored 7.9 against 7.7 for plain Opus at the same cost and took 5.7 minutes against 2.3; a low-effort implementor and a parallel reviewer didn't pay. |
| 5 | round 4's tasks with Sonnet and Opus subagents, then the sibling/hostile-input changes | Subagent model didn't move the score (Haiku 7.55, Opus 7.45, Sonnet 7.29, plain Opus 7.32); Opus agents doubled the cost. The sibling and hostile-input steps tied the shipped skill on these tasks (7.56) and led on one unseen task (8.52 against 8.30). |

### Tasks

| Task | What it is |
|---|---|
| `tailwind-anchor` | TypeScript: anchor-positioning utilities in tailwindcss |
| `chi-etag` | Go: an ETag middleware in go-chi/chi |
| `chi-mount-routes` | Go: a bug hunt in chi, given only the symptom |
| `click-duration` | Python: a `Duration` parameter type in click |
| `click-param-spec` | Python: a cross-module change in click |
| `fd-count` | Rust: a `--count` flag in fd |
| `discount-codes`, `reset-token-expiry` | Unseen tasks on a small Python shop package |
| `website-bookshop` | A four-page static site, accessible and responsive to 360px |
| `ui-lib` | React Tabs, Dialog and Combobox to the WAI-ARIA patterns, with hidden Testing Library tests |
| `website-trails` | A hiking-club site, held out from all tuning |
| `figma-button`, `figma-tabs` | Build from a saved Figma export, measured against its exact values |
| `risky-auth`, `risky-refunds`, `risky-inventory` | Auth tokens, refunds with idempotency keys, and stock reservations under threads, on the shop package |

The first six are "the benchmark" below.

### 1. Subagent model (round 5)

72 builds: 4 setups × 6 benchmark tasks × 3 reps. The three lite setups differ only in the agents' `model:`.

| Setup | Judge score | Cost per task | Subagent share | Median time |
|---|---|---|---|---|
| Plain Opus (no skill) | 7.47 | $0.62 | – | 2.4 min |
| Lite, Haiku agents | **7.65** | **$0.51** | $0.03 | 5.5 min |
| Lite, Sonnet agents | 7.55 | $0.68 | $0.23 | 3.4 min |
| Lite, Opus agents | 7.63 | $1.07 | $0.59 | 5.2 min |

- The three lite setups are statistically tied, and all three edge plain Opus.
- What separates builds is judgment no criterion named. Examples: HEAD handling and forwarding Hijack/Flush in chi-etag, a partial count on Ctrl-C in fd-count, and `property-order.ts` in tailwind. These misses were spread across every model.
- Stronger implementors wrote more, not better. Opus agents had the best tests score, and also made the two worst changelog edits of the run.

### 2. Sibling criteria and hostile inputs (v3)

Step 1 gained two paragraphs. **Sibling:** find the closest existing sibling and turn what it does into criteria. **Hostile inputs:** two or three per criterion.

| | Old skill | v3 | Plain Opus |
|---|---|---|---|
| Benchmark judge score | 7.55 | **7.56** | 7.32 |
| Hidden tests passed | 14/18 | **15/18** | 13/18 |
| Unseen task (discount-codes) | 8.30 | **8.52** | 8.07 |
| Cost per task | **$0.51** | $0.59 | $0.62 |

- A first variant run scored 7.73 with half the spread, but the jump didn't reproduce: most of it was luck on chi-etag.
- v3 has the best correctness, robustness and tests sub-scores of the three, and all three of its unseen-task builds ranked on top.
- A blocking "docs-truth" rule backfired. Builds dropped PR links to avoid inventing them, and inspectors scored that as a docs miss. The rule was dropped.

### 3. v4: tuning on probes

The judges' notes became 25 scripted probes, which let changes be iterated on cheaply. v4 added four changes: wrappers forward every optional interface, the repo's full check set, wider hostile inputs, and an Opus final read of the whole diff.

| | Old skill | v3 | v4 | Plain Opus |
|---|---|---|---|---|
| Probes passed | 73% | 75% | **89%** | 70% |
| Benchmark judge score | 7.52 | 7.60 | **8.04** | 7.39 |
| Spread (sd per build) | 1.10 | 0.79 | **0.33** | 1.11 |
| Unseen tasks (2) | 7.77 | **8.05** | 7.84 | 7.18 |

- The gain sat on the tasks the probes came from: chi-etag went from 6.17 to 7.83, and click-duration from 7.50 to 8.50.
- On unseen tasks v4 tied v3. It was not shipped, though the Opus final read was later folded into the skill.

### 4. New project types and the red-team reviewer (v5)

30 builds on `website-bookshop` and `ui-lib`. v5 adds an adversarial reviewer. It assumes the change has a bug, writes and runs probes against every criterion, and counts a finding as blocking only when a probe reproduces it.

| | Old | v3 | v4 | v5 red team | Plain Opus |
|---|---|---|---|---|---|
| Website | 7.00 | 7.62 | **7.68** | 7.33 | 7.28 |
| Component library | 6.58 | 6.83 | 6.25 | **8.00** | 6.25 |
| Spread | 0.63 | 1.10 | 0.81 | **0.50** | 0.75 |
| Cost per task | **$0.63** | $0.75 | $0.75 | $1.02 | $1.14 |

- Every v5 library build scored 7.5 or higher. The judges separated builds on nested dialogs, clearing the Combobox to null, and the active option surviving a change of options. Those are bugs you only find by writing a test that stacks components.
- On the website it didn't help: a probe can't reproduce taste.
- Plain Opus scored highest on product (8.25) and lowest on tests (4.33).

### 5. More reviewers and Opus triage (v6 to v8)

| | v5 | v6 (3, then 1) | v7 (3 every pass) |
|---|---|---|---|
| Both tasks | **7.12** | 7.02 | 7.08 |
| Cost per task | **$1.02** | $1.45 | $2.11 |

v7 made the best library and the best website, and also the two worst websites. Nine reviews means every pass finds something, and the extra fix rounds broke as much as they repaired.

v8 kept three reviewers, made them check the obvious things first in a real browser, and had Opus triage their findings. It was tested against a held-out hiking-club site.

| | v5 | v8 | v8-lean | Plain Opus |
|---|---|---|---|---|
| Bookshop | 7.30 | **7.42** | 7.12 | – |
| Component library | 7.33 | **7.98** | 7.77 | – |
| Hiking club (held out) | 6.83 | 6.83 | 7.17 | **7.83** |
| Cost per task | **$0.95** | $2.14 | $2.02 | $1.68 |

v8 fixed v7's swings on the tuned tasks, but the gain vanished on the held-out site at twice the cost. Its websites also stopped getting tests (2.7 to 3.3 against about 7 for v5).

### 6. Prompting lessons (v9)

v9 is v5 plus the advice from the Opus 5.5 and Sonnet 5.5 guides. That means a keep-going rule, a criteria scratch file, Opus re-running each blocking finding, a reviewer at high effort, a verify paragraph for the implementor, and a second Haiku reviewer that screenshots every page.

| | v5 | v9 | Plain Opus |
|---|---|---|---|
| Bookshop | 7.25 | **7.50** | 7.25 |
| Component library | **8.08** | 7.58 | 6.50 |
| Hiking club | 7.18 | 7.00 | **7.90** |
| All three | **7.51** | 7.36 | 7.22 |
| Cost per task | **$0.95** | $1.30 | $1.32 |

- The screenshot reviewer raised website product scores from 6.3–6.7 to 7.3.
- Website tests collapsed to 1.0–3.7, the same drop v8 showed. The likely cause, inferred but not tested, is the verify paragraph v8 and v9 share: for a static site the implementor treats loading the pages as the real check.
- The untested lead is v5 plus the screenshot reviewer alone.

### 7. The mod

The mod is a handoff guard that restores a dropped `ACCEPTANCE CRITERIA:` block, a note when an implementor leaves no test file changed, and per-role usage logging.

| | v5 | v5 + mod |
|---|---|---|
| Website, 6 builds each (one judging pass) | 7.00 | **7.31** |
| Component library, 3 builds each | 7.18 | **7.22** |
| Cost per build | $0.83–1.04 | **$0.79–1.00** |

- The first 3-build website round showed a 0.9 lead. With 6 builds it shrank to 0.3, and that gap is one v5 build whose nav CSS never applied.
- The guard fired in most mod builds, so Opus does drop the criteria block. A restored block doesn't show up in the score, though.
- The tests check never fired.
- The first per-role timings: the Haiku implementor takes about half of each run, then the Opus orchestrator.

### 8. Per-repo project file

PR #7 moved project-specific criteria into a per-repo `FEATURE_FLOW.md`, written from a template on the first run.

| Task | v5 + mod | Project file + mod |
|---|---|---|
| Website (JavaScript allowed) | 7.02 | **7.98** |
| Component library | 7.33 | **7.67** |
| Chi ETag | 7.77 | **8.30** |
| Cost per build | $0.94 | $1.16 |

- On chi-etag, every project-file build beat every v5 build. Each run's file recorded that a response-writer wrapper forwards Flush, Hijack, Push and Unwrap the way `compress.go` does.
- `.claude/` is a protected path in headless runs, so the file lives at the repo root.
- Every run wrote its file from scratch. A second run that reads an existing file isn't measured.

### 9. Figma to React

These are pass/fail runs on `figma-button` (30 variants) and `figma-tabs` (11 exact values plus 7 hidden keyboard tests). They were not blind-judged.

| Tabs build | Passed everything | Cost | Time |
|---|---|---|---|
| Plain Sonnet | 2 of 2 | about $0.23 | 45 s |
| Plain Opus | 2 of 2 | $0.55 | 90 s |
| Opus orchestrating Haiku (figma-flow or feature-flow-lite) | 3 of 3 | $1.94–2.20 | 12–16 min |
| Plain Haiku | 0 of 2 (and 0 of 2 Buttons) | $0.30–0.70 | 5–8 min |

- The exact-value test does the reviewer's job. It tells the builder precisely what's wrong, value by value, so a second agent has little left to find.
- The pipeline makes Haiku usable, but plain Sonnet gets the same result for about an eighth of the cost.
- So figma-flow builds directly, and figma-setup installs the measuring test and the mapping rules. A page-sized design, where a pipeline might matter, is still untested.

### 10. Opus reviewer on risky paths

The skill used to move the reviewer to Opus (at medium effort) for auth, payments, migrations, concurrency and the project file's risky paths. That rule came over from the full feature-flow skill and had never been tested. This round tested it.

There were three risky tasks on the shop package. Each had hidden tests aimed at the bugs a careless build makes:

- **Auth** (`risky-auth`): reset tokens. The hidden tests cover the 1800 s boundary, `now=0`, a default clock read at call time, reuse, and concurrent redemption.
- **Payments** (`risky-refunds`): refunds. They cover sub-cent, NaN and non-Decimal amounts, a replay after a full refund, an equal amount spelled differently, and whether a failed refund burns its key.
- **Concurrency** (`risky-inventory`): stock reservations. They race 24 threads for 10 units, 1000 times.

The hidden tests were checked against a careful and a naive reference: the careful one passes every case, and the naive one fails. That includes the oversell race, caught 6 times out of 6. The two arms were the shipped skill with its mod, and the same skill without the Opus clause. Each ran 5 builds per task. The results were scored by hidden test case (`hidden_cases.py`), not blind-judged.

| Task | Opus reviewer: cases | Haiku reviewer: cases | Opus cost | Haiku cost | Blocking findings (Opus / Haiku) |
|---|---|---|---|---|---|
| Auth | 15/15 in 5 of 5 | 15/15 in 5 of 5 | $0.62 | $0.48 | 0.2 / 0.8 |
| Refunds | 17/17 in 5 of 5 | 17/17 in 5 of 5 | $0.89 | $0.71 | 1.8 / 3.0 |
| Inventory | 14/14 in 5 of 5 | 14/14 in 5 of 5 | $0.76 | $0.60 | 0.8 / 2.4 |
| All | 30 of 30 builds perfect | 30 of 30 builds perfect | $0.76 | $0.60 | 0.9 / 2.1 |

- Every build in both arms passed every hidden case and `./check.sh`. The Opus orchestrator's acceptance criteria and hostile inputs already name these edges, so the implementor builds them right and the reviewer has little left to catch.
- The Haiku reviewer wasn't weaker on real bugs. It reproduced the single-use race in two auth builds and a concurrent over-refund in another (41 of 300 trials). Those are races the hidden tests can't reliably force. Opus found the same class of issues, for example decimal-context precision in refunds.
- Haiku raised more blocking findings, and more of them were contrived: int subclasses that override `__gt__`, a spoofed `__class__`, a mutated frozen dataclass. Fix rounds came out about even (1.6 against 1.5 implementor runs per build), so the extra noise didn't cost much.
- The tasks hit the ceiling, so this can't rule out a gain on a harder risky change. But 30 perfect builds without the rule leaves the rule nothing to prove, and it cost 27% more per build. It was removed. The reviewer stays a Haiku red team everywhere.

### Open questions

- Does v5 plus the screenshot reviewer alone (without v9's verify paragraph) keep the product gain and the tests?
- Does a second run that reads an existing `FEATURE_FLOW.md` do better than the first?
- Is a pipeline worth it for a page-sized Figma design?
- Does any gain this size hold at 5+ builds per setup? Most measured effects are within the noise of 3 builds.

### Raw data

Reports and raw judging live in the project's shared folder (`feature-flow-models/`): `report.md`, `old-vs-new-report.md`, `v4-report.md`, `new-project-types-report.md`, `mod-report.md`, `project-file-report.md` and `raw/`. Round 4's traces, diffs and gradings are attached to the `feature-flow-lite-v1` release.

## Trigger cases (`triggers/`)

There are eight cases: four that should fire the skill and four near-misses that shouldn't (a one-constant bump, a question, a branch review, and a design note with no implementation). Each case seeds the `shop` fixture repo through `scaffold.sh` and stops after eight turns, so a run checks only whether the skill was chosen. A bug-hunt prompt can investigate for a few turns before it reaches for the skill, so keep the cap generous.

```sh
cd feature-flow-lite
claude plugin eval . --tag trigger --ablation none --scaffold --trust-plugin --no-publish --max-cost-usd 15 -j 4
```

The last run fired on 11 of 12 should-trigger runs (one `gift-cards-on-a-budget` run answered without it) and on none of the 12 near-miss runs, for $4.42.

Pass `--ablation none` here, because a no-skill arm can never fire the skill. Runs execute in an isolated home directory, so other installed skills don't compete for the trigger. Expect about $0.50 per run on Opus. The default is three runs per case.

## Harness (`harness/`)

`run.py` copies `fixtures/shop` into a fresh temp git repo for each run and runs `claude -p` there with `--output-format stream-json --verbose --forward-subagent-text`. In a skill arm the skill folder loads with `--plugin-dir`, so its named agents load too, and the run invokes it as `/feature-flow-lite:feature-flow-lite` (or `/feature-flow:feature-flow` for the full skill). That separates "does it behave" from "does it trigger". `grade.py` then reads the trace and runs the hidden checks against the workspace.

```sh
cd feature-flow-lite/evals/harness
python3 run.py --dry-run                                  # show the commands
python3 run.py -s chi-etag -a lite-v2,baseline -n 3 -j 3
python3 run.py                                            # every scenario, lite-v2 + baseline
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
| `tailwind-anchor` | Feature in tailwindlabs/tailwindcss (TypeScript): anchor-positioning utilities. Hidden vitest file, full package suite, tsc on touched files, Prettier, changelog. |
| `chi-etag` | Feature in go-chi/chi (Go): an ETag middleware. Hidden tests in their own package with `-race`, full suite, vet, gofmt, README table row. |
| `click-duration` | Feature in pallets/click (Python): a `Duration` parameter type. Hidden pytest file, full suite, strict mypy, ruff, changelog, docs. |
| `fd-count` | Feature in sharkdp/fd (Rust): `--count`. Black-box tests against the built binary, full suite, clippy, fmt, changelog, man page, and the zsh completion (a convention the prompt doesn't mention). |
| `chi-mount-routes` | Bug hunt in go-chi/chi, pinned just before the upstream fix for #830: Walk and Routes() drop a handler that shares a pattern with Route()/Mount(). The prompt is the symptom, not the cause. Hidden checks are the upstream regression tests (renamed) plus one more, the suite, vet, gofmt, a regression test added, and no edits to middleware/. |
| `click-param-spec` | Cross-module feature in pallets/click, pinned just before upstream #3877: `Parameter.spec`, `get_help_spec` moved to `Parameter`, specs in error messages, and a `human_readable_name` deprecation that warns on subclass overrides. Hidden checks are the upstream tests plus extras, the suite (an existing test must be updated), mypy, ruff, changelog, upgrade guide and parameters docs. |
| `figma-button` | Build a Button from a saved Figma export, for figma-flow. The export holds the exact values of 30 variants; the hidden check puts back the pristine export and test, then measures every variant in Chromium in real hover, press and focus states. No Figma access needed. Run it with `-j 1`: the fixture's dev server uses a fixed port. |
| `figma-tabs` | Build Tabs from a saved Figma export, for figma-flow: four components with layout, five tab states, and the WAI-ARIA keyboard pattern. Two hidden checks: the pristine exact-value test (11 cases) and behaviour tests the build never sees (7 cases: roles, roving tab stop, arrows wrapping past a disabled tab, Home and End). Run it with `-j 1`. |
| `risky-auth` | Auth: the `reset-token-expiry` prompt with harder hidden checks: the 1800 s boundary, fractional seconds, `now=0`, the default clock read at call time, reuse inside the window, independent tokens, and 8 threads redeeming one token (300 trials). |
| `risky-refunds` | Payments: orders and partial refunds with idempotency keys. Hidden checks cover zero, negative, sub-cent, non-Decimal, NaN, sNaN and infinite amounts; whole-cent spellings (`1.5`, `1E+1`); a replay after a full refund; a replay with `5` for `5.00`; a failed refund leaving its key unused; keys scoped per order; and the total fixed when the order is placed. |
| `risky-inventory` | Concurrency: stock reservations under a thread pool. Hidden checks cover the settle-twice paths, qty types (float, str, None, bool), a failed reserve changing nothing, and three races over 1000 trials each (24 threads for 10 units, 8 threads releasing one reservation, commit against release). |

The feature and bug-hunt scenarios clone the repo at a pinned commit through `fixtures/setup_repo.sh` (or `setup_tailwind.sh`), caching clones and builds under `~/.cache/ff-evals`. Each hidden folder holds a `reference.patch`; the hidden checks fail on the untouched repo and pass with it applied.

The first seven scenarios run on `fixtures/shop`, a small Python package, and were written for the full feature-flow pipeline, so some of their process checks (verifier, security reviewer, explorer) name roles lite doesn't have. The round-1 and round-2 greenfield tasks (a website, a Go API and a Rust CLI) are retired; their results are in the report.

Process checks (`kind: process`) apply only to skill arms. Outcome checks (hidden tests, `./check.sh`, untouched files, the final answer) apply to every arm. Every pipeline scenario also gets the generic rules in `grade.py:PIPELINE_RULES`: pinned models (an alias on the call, or a named agent's frontmatter), named agents used when they're loaded, roster models (taken from the model each subagent actually ran on), the handoff and result templates, stages announced before the first spawn, checks after the last edit and before each review, the 2-round cap, at most one debugger, nested verifiers awaited, no depth-limit refusals, and a final report that names the agents.

### Arms

`scenarios.json` defines these arms. All of them run the main session on Opus at medium effort, except `sonnet-solo`:

| Arm | What runs |
|---|---|
| `lite-v2` | feature-flow-lite as first released (`eefc1bc`): Haiku agents at medium effort, a write-once implementor with targeted tests, conventions in the acceptance criteria |
| `lite-v2-impl-low` | lite-v2 with only the implementor at low effort (`agents.only`) |
| `lite-v3` | feature-flow-lite from the working tree, with the sibling and hostile-input steps |
| `lite-v2-sonnet`, `lite-v2-opus` | the shipped skill with every agent on Sonnet or Opus |
| `lite-v2-sibling` | the shipped skill with the `sibling-criteria` variant (the sibling and hostile-input steps plus a docs-truth reviewer check) |
| `figma-front` | figma-flow from the working tree with its mod. It builds directly; the feature-flow-lite handoff it once had was removed after it matched plain Opus at 2.5 to 3.5 times the cost. The pipeline process checks don't describe it. |
| `baseline` | No skill |
| `sonnet-solo` | No skill, with Sonnet as the main model |
| `haiku-solo` | No skill, with Haiku as the main model |
| `lite`, `lite-haiku` | feature-flow-lite at `2540fb3`, before it moved to Haiku: Sonnet agents, or every agent pinned to Haiku at high effort |
| `skill`, `skill-v2`, `skill-haiku` | The full feature-flow skill at its last commit (`1a69784`), at `2540fb3` (with the direct path), and at `2540fb3` with every agent on Haiku |
| `skill-v1`, `skill-v0` | feature-flow with named agents (`b6eface`), and as first committed (`0263562`), loaded as a bare project skill with no agents |
| `lite-opus-reviewer`, `lite-no-opus-reviewer` | The skill with its mod before the Opus-reviewer clause was removed (`f11f50c`; the batch ran it as `lite-pc-mod`), and the working tree |
| `lite-simplifier-always` | The working tree with its mod, and a SKILL.md (`variants/simplifier-always`) that runs the simplifier on every diff. Without it the orchestrator skips the simplifier on diffs it calls small, so the simplifier and its mod checks never run. |

The full feature-flow skill isn't in the tree any more, so its arms load it from history: an arm can pin any git `ref` of any skill `folder`, and the harness extracts that version with `git archive`. An arm can also lay a variant's files over the skill (`variant`: `harness/variants/<name>/`, which can replace SKILL.md or add and replace agents), pin every agent's model and effort or a single agent's (`agents`), and tell the grader which model every role should run on (`roster_model`). The skill's value claim is that `lite-v2` matches `baseline` on outcomes for no more money.

### Gotchas

- Uninstall any user-level copy of feature-flow-lite (or feature-flow) before running the baselines. Every run records the skills it loaded, and a run whose arm loaded the skill when it shouldn't have (or the reverse) fails the setup check.
- The harness strips session-scoped variables (`CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT`, `CLAUDE_CODE_SUBAGENT_MODEL`, …) so the calling session's model and effort don't leak into the runs, and it sets the spawn depth explicitly (3 unless the scenario says otherwise).
- Every run is capped with `--max-budget-usd`, and `run.py` prints the worst-case total before it starts. On Opus, one rep of everything with both arms usually costs a few dollars.
- One rep is a smoke test, not a result. Agents choose their stages freshly on each run, so compare arms at `-n 3` or more.

### Hidden tests by case

```sh
python3 hidden_cases.py results/<batch> [results/<batch> ...]
```

A hidden check passes or fails as a whole file. `hidden_cases.py` re-runs each run's hidden tests verbosely in its workspace and prints, for each scenario and arm: mean cases passed, builds that passed every case, cost, reviewer models, `[blocking]` findings returned, implementor rounds, and how often each case failed. It needs the workspaces in `/tmp`.

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

Then ask Claude Code to run `judge.workflow.js` as a workflow, passing the challenges (`id`, `kind`, `prompt`, and the `builds` letters and dirs) as `args`. For a change in an existing repo use `kind: "feature"`, pass each build's `diff`, and give a `probe`: the commands to run in the inspector's copy and the edge cases to try. Blind copies leave out build output and virtualenvs, so probes should rebuild or re-sync first. One inspector per build builds it, runs it, probes edge cases, and scores it. One judge per challenge (or `judges: N` independent ones, to measure judge noise) then reproduces every blocker and major defect the inspectors claimed and ranks the builds on a single scale. Unblind the results with `results/<batch>/blind-mapping.json`.

### Adding a scenario

Add an entry to `scenarios.json`. It needs a `prompt`, and can take an `overlay` (files copied over the fixture), a `setup` command, `risky`, `depth`, `budget_usd`, and a list of `checks`. A check is either `{"cmd": ...}`, which runs in the workspace with `$HIDDEN` pointing at `hidden/<id>/`, or `{"rule": ...}` naming a function in `grade.py`. Put any hidden tests in `hidden/<id>/`, and confirm that they fail on the untouched fixture and pass on a hand-written fix.
