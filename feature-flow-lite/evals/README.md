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
| Review gate | One Opus agent reviews and decides, criteria checked before building, a check cache | The criteria check fixed chi-etag's Flush criterion in 1 of 2 builds (the first hidden Flush pass). Not faster: 2 to 6 gate rounds, about 35 min. The cache saved 0.5 to 1.2 min. | Not yet (2 builds) |
| Review panel | Three Opus gatekeepers at once (request, edges, repo), one fix round each, a fresh final gate; plus a mod that runs base checks and checks ahead | Panel alone: 18.8 min on chi-etag and 22.9 min on react-aria, every hidden test passing on both, matching the current skill's time on react-aria. The mod made react-aria 2–3× slower. | Panel promising (1 build per task); mod's check-ahead no |
| Check queue | Background checks queued for one low-priority, one-thread worker that agents can preempt | On react-aria, same load: panel + queued mod 25.2 min, panel alone 27.9 min; both pass everything and the audit would merge both (against 51–64 min for the unqueued mod). Also fixed two base-check bugs. | Keep (1 build per arm) |
| Heavy limiter | The queued mod with heavy-limiter (one machine-wide pool of cores and memory), on the final code, the macOS port included | One react-aria build alone: 30.2 min, every outcome check and the probe pass; the audit wanted two new eslint nesting warnings fixed. Base checks, agents' checks and queued checks all ran through the pool; nothing waited. | Works end to end (1 build) |
| Panel repeats | Do the panel's time and quality hold over more builds? | Quality held: all 4 new builds pass every outcome check, and the audit would merge all 4. Time didn't: chi-etag took 25.4 and 37.0 min against 18.8, because fix rounds vary from 1 to 4. | Panel kept; time is 19–37 min, not 20 |

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

### 11. No round cap: loop until the orchestrator is satisfied

The `until-satisfied` variant drops the two-round cap. Every fix is followed by the full checks and a fresh reviewer on the whole diff (not just the changed hunks), and the orchestrator stops only when the checks pass, the latest reviewer reproduced nothing, every criterion and hostile input was exercised, and its own final read is clean. Arm `lite-until-satisfied` against the working tree with its mod (`lite-pc-mod`), 3 builds each on chi-etag, click-duration, click-param-spec and fd-count. Scored on hidden tests and probes, not blind-judged.

| | Capped (shipped) | Until satisfied |
|---|---|---|
| Outcome checks passed | 0.91 | 0.93 |
| Probes passed | **0.89** | 0.86 |
| Cost per build (mean / max) | **$1.19** / $1.48 | $1.32 / $2.28 |
| Reviews per build | 1.25 (max 2) | 1.92 (max 5) |
| Builds with only one review | 8 of 12 | 8 of 12 |

- The cap never bound. No capped build went past one fix after its first review, so removing it changes nothing on most runs: in 8 of 12 uncapped builds the orchestrator was satisfied after the first review.
- When the loop did run long (5 reviews on one click-duration and one click-param-spec build), it cost up to $2.28. click-duration was the one task where the uncapped arm passed every hidden test (3 of 3 builds against 2 of 3), but the probe totals didn't move.
- chi-etag failed `TestFlushDoesNotBypassTheBuffer` in all 6 builds of both arms: every build streams the response when the handler flushes, and the hidden test expects the buffer to hold. More review didn't change a choice the acceptance criteria made.
- So "more reviews" doesn't come from removing the stop. It would have to be required, for example "done only when a fresh reviewer returns no blocking findings", and that is v7's pattern, which cost more without a reliable gain.

### 12. Merge gate: a fresh maintainer decides when it's done

The goal: when the orchestrator says done, the change should be mergeable. The `merge-gate` variant adds a fifth agent, a gatekeeper. After the reviewer's (still capped) fix loop, a fresh gatekeeper gets the user's request word for word and the base commit, runs the full checks, writes its own probes, and returns `MERGEABLE: yes|no` with tagged must-fixes. Every no goes back to the implementor and a new gatekeeper reads the whole diff. There is no round cap, and the report opens with `Mergeable: yes` or `Not mergeable:`. Scored with hidden tests, probes and `audit.py`: a separate headless Opus that sees only the request and the workspace, read-only, and says whether it would merge (high effort on react-aria, medium elsewhere).

A harder task was added for this: `rac-shadow-hide`, making react-aria's `ariaHideOutside` work across shadow DOM in the react-spectrum monorepo (jest, eslint, tsgo, the yarn lockfile). Its hidden tests are upstream's shadow DOM tests plus five more. The audit found a bug no hidden test covers (a target nested in a shadow root inside another target hides that target's content; upstream's own fix has it), and it became the scenario's probe.

| 3 builds per task | Current skill | Opus medium gate | Opus xhigh gate |
|---|---|---|---|
| chi-etag: audit would merge / probes | 3 of 3 / 17 of 21 | 3 of 3 / 17 of 21 | 3 of 3 / 17 of 21 |
| click-duration: audit would merge / probes | 1 of 3 / 19 of 24 | 3 of 3 / 18 of 24 | 3 of 3 / 18 of 24 |
| rac-shadow-hide: audit would merge / nested-target probe | 1 of 3 / 2 of 3 | 0 of 3 / 0 of 3 | 1 of 3 / 3 of 3 |
| Cost per build (chi, click, rac) | $1.35, $1.20, $1.31 | $2.05, $1.63, $1.67 | $3.30, $3.28, $2.72 |

- **Opus at medium approved too easily.** On react-aria it passed all three builds in its first round, and all three had the nested-target bug. Across 4 other tasks it raised 1 must-fix in 12 builds.
- **Opus at xhigh is the first gate that caught the react-aria bug:** 3 of 3 builds pass the probe. The audit still rejected one finished build for a different bug (light DOM slotted into a target's shadow tree is hidden), and one build hit the 90-minute run limit in its second gate round, leaving its probe files in the repo. That makes 1 of 2 finished builds clean by the audit.
- On click-duration both gates fixed what the audit flagged on the current skill (the docs example that never succeeds, help text for timedelta defaults).
- chi-etag fails the hidden `TestFlushDoesNotBypassTheBuffer` in every build of every arm. No gate moved it: the builds stream on `Flush`, a choice the acceptance criteria make.
- **Fable 5.2 at xhigh as the gatekeeper** rejected 7 of 8 first-round builds with real must-fixes (the react-aria bug, the missing lockfile entry, HEAD losing `Content-Length` in chi), but cost $4 to $11 a build. Its batch is not a result: `claude -p` stops background subagents 10 minutes after the orchestrator's last turn, which cut off 7 of 8 builds mid-gate. The harness now sets `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` and warns when a run was cut off.

### 13. Council: ten Haiku councillors instead of one gatekeeper

The `council` variant replaces the gatekeeper with ten Haiku councillors at xhigh, run in parallel, each starting from a different angle (the request, edge inputs, callers, docs, tests, conventions, errors, cleanup, other entry points, free). Any no is investigated by the orchestrator: a must-fix it reproduces goes to the implementor and a new council of ten votes; one it disproves is dismissed with evidence. It was stopped partway: 4 of 9 builds finished, costing $5.70 to $11.33; the others were on rounds 3 to 6 at $7 to $10.

- It doesn't converge. Ten strict reviewers almost always produce one no. In one chi-etag build the rounds went 1, 2, 6, 8 and 8 yes out of 10. The first two rounds found real bugs the reviewer missed (Hijack after a buffered write), and the later ones found smaller and smaller edges (a non-canonical header key, trailers).
- Dismissed objections come back. A fresh council doesn't know what was ruled on, so the orchestrator re-argues it, or gives in: one HEAD objection was dismissed in round 2 and fixed in round 3 "since seats keep citing the request's literal wording".
- 10 of 10 yes isn't proof. The one chi-etag build that got a unanimous council still fails the hidden Flush test.
- About 1 in 5 councillors re-ran a repo-wide lint or test suite despite being told not to.

**With disqualifiers (`council-dq`, one chi-etag build).** Councillors drop an objection that is already ruled on, beyond the request, not reproduced, about wording or style, pre-existing, or needs API misuse, and list what they dropped. The orchestrator passes a `RULED ON:` list to every council and only new evidence reopens a ruling. The build took 2 rounds (7 yes / 3 no, then 10 of 10), 33 minutes and $4.00, against 5 or more rounds and $9 to $11 for the three chi-etag builds without them. Round 1's no-votes were real: a doc comment that overclaimed, and a memory regression the simplifier introduced (the flushed buffer kept until the handler returns). Most drops cited a ruling; some cited misuse or pre-existing behavior. The audit would merge it, and probes and hidden tests match the other arms (5 of 7 probes, and the same hidden Flush failure). One drop counts against it: a handler setting `ETag` under a non-canonical map key was dropped as misuse, though Go allows it and the `NonCanonicalKey` probe fails. One build is a smoke test, not a result.

**As the review stage (`review-council`, one build each on rac-shadow-hide and chi-etag).** Five Haiku councillors at xhigh replace both the reviewer and the gate, with the disqualifiers and `RULED ON:` list; seat 1 always audits the acceptance criteria against the request, and yes votes are three lines. Neither build converged cheaply. react-aria took 4 rounds, 75 minutes and $8.55 (against $2.72 for the Opus xhigh gate) and reported `Mergeable: yes`; it passes the hidden tests and the nested-target probe, but the audit rejected it for the slot case the orchestrator had set aside as a decision for the user. chi-etag hit the 90-minute limit in round 6, with votes of 0, 1, 3, 4, 2 and 1 out of 5. The disqualifiers worked (dozens of drops citing a ruling, pre-existing behavior or style); the rounds continued because each fresh council found new, real but smaller issues, such as Timeout's 504 becoming a 200 and untested branches found by mutation. Seat 1 corrected contradictory criteria but accepted the Flush criterion, so the hidden Flush test still fails. A council with no round cap finds more than one gatekeeper but doesn't settle.

**Gatekeeper that audits the criteria (`merge-gate-criteria`, one chi-etag build).** The Opus xhigh gatekeeper's first step checks every acceptance criterion against the request and returns a CRITERIA line per criterion. It took 3 gate rounds, 41 minutes and $6.30. It is the first chi-etag build to pass all 7 probes, and the audit would merge it. It still fails the hidden Flush test: the gatekeeper marked the Flush criterion ok in every round, because streaming on `Flush` is what the sibling (`compress.go`) does, and the skill's own sibling rule makes forwarding every optional interface a criterion. Either that rule needs "unless it contradicts the request" (the request says the middleware buffers the response), or the hidden test is stricter than the request.

### 14. Review gate: one Opus agent reviews and decides, and a check cache

The aim was the merge gate's quality in less time. The `review-gate` variant makes four changes:
- One `gatekeeper` (Opus at high effort, set in its frontmatter) does the Haiku reviewer's red team and the gatekeeper's merge verdict in one pass. The reviewer's capped loop is gone, and only the uncapped gate loop remains.
- The investigator starts in the background as the skill starts, so it runs while the orchestrator reads the project file and writes the criteria.
- Before the implementor runs, a fresh read-only `criteria-checker` (Opus at medium effort) checks every criterion against the request, sentence by sentence, and against the closest sibling. Opus because the job is judgment on a short input, and medium because the input is a page. Every earlier criteria auditor ran on finished code, after the choice was already built.
- The gatekeeper is told not to rerun a suite the orchestrator just ran on the same tree.

Arm `lite-review-gate`, plus `lite-review-gate-cache` with the mod's check cache on (`FEATURE_FLOW_CHECK_CACHE=1`, set through the new per-arm `env`). One build per task, two builds at a time on an otherwise idle 4-CPU machine.

| | chi-etag, cache off | chi-etag, cache on | rac-shadow-hide, cache off | rac-shadow-hide, cache on |
|---|---|---|---|---|
| Wall time | 37.7 min | 37.7 min | 34.7 min | 31.7 min |
| Cost | $5.89 | $5.63 | $2.73 | $4.14 |
| Gate rounds | 6 | 5 | 2 | 3 |
| Criteria check on the Flush criterion | `[wrong]`, rewritten | `[nit]`, "needs user sign-off", kept | – | – |
| Hidden tests | **all pass, Flush included** | fail `TestFlushDoesNotBypassTheBuffer` | pass | pass |
| Probes | 5 of 7 | 5 of 7 | nested target passes | nested target passes |
| Audit would merge | yes | yes | yes | no: shadow roots a target is slotted into are never walked |
| Cache hits / misses, check time replayed | – | 4 / 23, 0.5 min | – | 5 / 20, 1.2 min |

Against the baselines (3 builds each): the current skill took 16.8 min and $1.35 on chi-etag and 22.3 min and $1.31 on rac-shadow-hide. The Opus xhigh gatekeeper took 33 min and $3.30 on chi-etag, and $2.72 on rac-shadow-hide (73 min on an overloaded machine).

- **The criteria check is the first thing that moved chi-etag's hidden Flush test.** In one of two builds it called "Flush ends buffering" a rule the request never states. It quoted "buffers the response … sets a strong ETag" and noted that `compress.go`'s Flush only forwards. The orchestrator rewrote the criterion, and that is the first build of any arm to pass `TestFlushDoesNotBypassTheBuffer`. In the other build the checker called the same criterion "reasonable, matches compress.go", asked for user sign-off, and the orchestrator kept it to avoid hanging server-sent-event (SSE) handlers. The checker also caught a no-ETag-for-empty-HEAD rule in both builds, and on react-aria a hostile input that would hide content inside a target. One fix, then: when the request's words and the sibling's behavior conflict, the request wins (the gatekeeper in section 13 made the same mistake; see its note).
- **It is not faster.** The merged agent still loops until it finds nothing, and on chi-etag each fresh Opus round found a smaller real issue: header snapshots, hijack, a doc sentence, trailers leaking, a trailer name net/http won't send. That makes 5 or 6 rounds at about $5.75, against 3 rounds and $6.30 for the one `merge-gate-criteria` build. react-aria took 2 to 3 rounds, about the same as the xhigh gate. Both chi-etag builds fail the same probes (`GarbageMember`, `NonCanonicalKey`), and the `merge-gate-criteria` build passed all 7.
- **The orchestrator edited code itself once.** A chi-etag build fixed a doc comment in `etag.go` "because it was only a doc change", which the skill doesn't allow.

**The check cache.** The mod's `tool.call` hook on Bash splits each command into sub-commands. It recognizes checks: go test/vet, gofmt -l, golangci-lint, pytest, mypy, ruff, cargo, the yarn/npm/npx jest, eslint, check-types and tsc scripts, and the project file's Checks. It drops flags that don't change the result (`-count=1`, `-timeout`, jest `--no-cache`) and routes each check through `hooks/ffcc.sh`. The wrapper takes the key when the check starts: the normalized check, the directory, HEAD plus the hash of every modified and untracked non-ignored file, and the toolchain (tool versions and install state outside git, such as `node_modules/.yarn-state.yml`). So a `cd`, an edit earlier in the same call, or another agent's edit is always seen. On a hit it prints the stored output and exit status, so pipes and `&&` behave as before. On a miss it runs the check, and stores the result only if it passed.
- Concurrent runs of the same key wait on one lock, so the second agent replays the first agent's pass.
- Results on the clean base commit are kept, pass or fail. A later failure of the same check gets a note saying whether the check also failed at the base commit.
- Commands that write are never cached: `--fix`, `gofmt -w`, `ruff format` without `--check`, `jest -u`, installs, or anything after an edit or install in the same call.
- The note the model sees after a replay reads: "feature-flow-lite check cache: replayed `go test ./...` from a passing run 60s ago on the same tree (fingerprint …: HEAD 1a2b3c4 + 2 changed files, same toolchain), saving ~30s."
- The wrapper costs 60 to 90 ms per check, react-spectrum included. Tests are in `hooks/check-cache.test.ts`, and `cache_stats.py` reports hits and time saved per run from each workspace's `.git/ff-check-cache/ledger.tsv`.

Results:
- **The cache saved 12% and 31% of wrapped check time, 0.5 and 1.2 minutes.** That doesn't show in wall time: the gate loop's rounds swing it by more.
- **Most misses were real changes to the tree between rounds.** The hits were the repeats the cache was meant for: the orchestrator rerunning a suite, and a second agent rerunning eslint and check-types right after another had.
- **The cache had less to save in this variant.** Its check commands came to 6 to 8 minutes of Bash time per build, against the ≈20 check-minutes measured for the Opus xhigh gatekeeper arm. With no separate reviewer and the don't-rerun rule, most repeats are gone before the cache sees them.
- **Subshells weren't cached in this batch.** Agents often write checks inside `( … )` subshells, and the parser skipped those; it now handles them. Measure the cache again on an arm with more repeats (`lite-merge-gate-opus-xhigh`), or make it the default since it costs nothing.

### 15. Review panel: three gatekeepers at once, and the mod's extras

Section 14 showed that the number of gate rounds sets the clock. The `review-panel` variant changes `review-gate` so that each round covers more ground and fewer rounds are needed:
- At step 8 the orchestrator spawns three gatekeepers in one message, each with a `FOCUS`. *request* probes every sentence of the request and every criterion. *edges* probes what the code wraps and its edge inputs, running the same inputs with and without the wrapper across call orders and diffing every output. *repo* covers conventions, the sibling, docs, tests and the full checks.
- Fixes batch every must-fix, with "change only what each must-fix needs; any other change in behavior is a regression". Each gatekeeper is then continued with `SendMessage` to verify its own items, which needs session persistence (`persist_session` in the arm). A fresh `FOCUS: all` gate then makes the final call, given the `RULED ON` list.
- Step 0 also starts the full checks on the untouched tree in the background. After that, only the affected checks run.
- The criteria checker is told that the request wins over the sibling.

`review-panel-mod` is the same with `FEATURE_FLOW_EXTRAS=1` on, which turns on these mod parts in `hooks/register.ts` and `hooks/extras.ts`:
- base checks in a worktree of the base commit;
- running the orchestrator's checks ahead after each implementor or simplifier, so the result is cached when asked for;
- the request and earlier must-fixes appended to every gatekeeper handoff;
- probe-file cleanup;
- a timeline in `/ff-usage`.

A mod-side fan-out of `FOCUS: panel` exists but isn't used, because `claude -p` exits without waiting for agents a mod spawns: two builds were cut short by it.

| | chi-etag panel | chi-etag panel + mod (2 builds) | rac-shadow-hide panel | rac-shadow-hide panel + mod (2 builds) |
|---|---|---|---|---|
| Wall time | **18.8 min** | 23.5, 31.2 min | **22.9 min** | 50.9, 63.5 min |
| Cost | $4.85 | $4.49, $7.30 | $5.30 | $9.52, $6.01 |
| Hidden tests and outcome checks | all pass, Flush included | all pass | all 6 pass | all 6 pass (one type-check failure was the grader's Node crashing under load; it passes alone in 19 s) |
| Probes | 5 of 7 | 5 of 7, **7 of 7** | nested target passes | nested target passes in both |
| Audit would merge | yes | yes, yes | no: slot anchors aren't found for closed shadow roots | yes; no (no test for content added later to an outer shadow root) |
| Cache time saved for agents / waited on shared runs | – | –, 3.3 / 1.6 min | 1.2 / 0 min | 14.6 / 8.1, 10.3 / 8.4 min |

Results:
- **The panel is the first merge-gate variant to match the current skill's clock on react-aria** (22.9 against 22.3 min), and it took chi-etag from 38 min (`review-gate`) to 19 min with the hidden Flush test passing. It does this by catching most issues in one parallel round: on react-aria the panel found the nested-target bug at minute 12, and the final gate found one slotted-target issue.
- **It costs 3–4× the current skill** ($4.85–$5.30 against about $1.35), because the gatekeepers are Opus.
- **The mod's checks-ahead and base checks made react-aria slower, not faster.** With two builds sharing 4 CPUs, the background checks competed with the agents. The implementors took 9–10 min instead of about 4. Agents waited 8 min each on shared in-flight runs, and the mod's own runs were mostly repeats (45 and 33 of its runs were hits on results it already had). One build also reran the whole repo's `yarn test` at the end, a 17-minute tail with two flaky suites failing. On chi-etag (a small Go repo) the mod's cost was small, and its best build passed all 7 probes. That build's three fix rounds came from the verifying gatekeepers finding trailer and 1xx issues, not from the mod.
- **Keep:** the panel and the check cache (agent replays saved 10–15 min of check time per react-aria build).
- **Drop or gate:** checks-ahead and base checks. Run them only when the machine is idle, or only for checks under a minute.
- `cache_stats.py` now counts only agents' hits as time saved. Before, the mod's own repeat hits were counted, which reported 55 min "saved" for one build.

### 16. A queue for the mod's background checks

Section 15's mod started its checks ahead and its base checks as soon as they were asked for, all at once and at full parallelism, so on react-aria they took CPU and memory from the agents. Now they are queued (`hooks/ffcc-queue.sh`):
- One worker per repo runs one job at a time under `nice -n 19` and `ionice -c3`.
- Each check runs with one worker thread: `go test`/`go vet -p=1`, jest and vitest `--maxWorkers=1`, `CARGO_BUILD_JOBS=1`. The cache key stays the full check's.
- Jobs run cheapest first, by their last run time in the ledger, and base-commit jobs run last.
- A newer tree's batch drops the jobs still queued for an older tree, and a job whose result is already cached is skipped.
- An agent that asks for a queued check runs it itself, and the queued job then finds the result cached. If the worker is already running that check, the agent waits only if the run should finish within 30 s. Otherwise it stops the run's whole process group and runs the check itself, and the stopped run records nothing (`preempted` in the ledger).

Two builds at once on react-aria, one with the queued mod and one without:

| | Panel + queued mod | Panel without the mod |
|---|---|---|
| Wall time | **25.2 min** | 27.9 min |
| Cost | $5.84 | $5.98 |
| Outcome checks, nested-target probe | all pass | all pass |
| Audit would merge | yes, no must-fix | yes, no must-fix |
| Orchestrator foreground Bash | 0.3 min | 4.2 min |
| Agents' cache hits, time saved, time waited | 6, 1.2 min, 0.6 min | 1, 0.2 min, 0 |

- **The queue removed the mod's slowdown.** It used to cost 51–64 min against 23; now it is level with, or slightly ahead of, the panel alone. That is one build per arm, so read it as "no longer harmful", not as a measured gain.
- **The load came from the build without the mod.** At minute 14 the load average was 15.7 on 4 CPUs, from that build's orchestrator running the whole repo's `yarn jest --maxWorkers=4` in the foreground.
- **Memory is the limit on this machine.** React-spectrum's type check (`tsgo`) peaks at about 5–6 GB. Two audits running it at once with a third check got one process killed for lack of memory.

Two bugs found along the way:
- **Placeholders with spaces in the project file ran as checks.** `yarn jest <changed package test dirs>` was read as a command, with its `<` as a redirect, so the mod ran jest over much of the repo on the base commit. A placeholder is now any `<…>` that starts with a letter.
- **The base commit's type check failed falsely in a monorepo.** The base worktree symlinked the main tree's ignored paths. TypeScript followed the real paths of `node_modules` and of generated files (the icon type definitions) back into the main tree, and saw the edited packages there as a second copy. That false base failure would make a new type error look pre-existing. The base worktree now hard-links its ignored paths (`hooks/ffcc-base.sh`): no disk cost, workspace links resolve inside the worktree, and files tools rewrite in place (`*.tsbuildinfo`, lint caches) are left out. React-spectrum's base `check-types` now passes in 18 s.

### 17. With heavy-limiter, on the final code

`heavy-limiter` (its own plugin, built on macOS on the `claude/machine-limiter` branch) is one machine-wide pool of cores and memory. Every Claude session on the machine shares it, and each heavy command waits for room in it. The cache scripts were ported to macOS at the same time (`hooks/ffcc-portable.sh`), and `hooks/ffcc.test.sh` tests them. On Linux, the 38 shell tests pass with the Linux tools, and again with `flock`, `setsid`, `timeout` and `sha256sum` hidden, so that the macOS stand-ins run.

One gap between the two mods was fixed before the run. When the cache rewrote an agent's call first, the queue ran its jobs as plain checks, outside the pool, so a 6 GB background type check went uncounted. Now `ffcc.sh` keeps the limited command line of each check that went through `heavy.pl`, minus the agent's notes file. A queued job runs through it, and `heavy.pl` sees `FF_CACHE_BG` and queues it behind agents' commands. Shell tests cover both rewrite orders with the real `heavy.pl`.

Arm `lite-review-panel-mod-heavy` is the queued mod with heavy-limiter loaded (`also`). One react-aria build ran alone:
- **30.2 min and $7.18.** Every outcome check and the nested-target probe pass. The audit would not merge it: the change adds two eslint `max-depth` warnings in `ariaHideOutside.ts`, a finding about the build's code.
- **The time went to the review loop, not the infrastructure.** The fix round took 4.6 min and the final gate 4.5 min. The orchestrator spent 0.7 min in foreground Bash, and nothing waited for a slot. The earlier builds took 25.2 and 27.9 min, within the spread between builds of one arm.
- **The base commit's type check passed in 18 s in a full build**, which confirms the hard-link fix from section 16.
- **The agents' checks and the queued background check all went through the pool.** The pool measured react-spectrum's type check at 6.8–6.9 GB, and from then on weighs it by that instead of its 3 GB default. Agents' cache hits saved 3.1 min.
- **What this build doesn't show:** whether the pool helps under contention, since nothing competed with it. That needs several sessions at once, such as two builds with heavy-limiter against two without.

### 18. More review-panel builds

Four more builds of the plain panel (`lite-review-panel`, no mod), two at a time, to see whether section 15's single builds were typical. With them, chi-etag has 3 panel builds and react-aria 4 (section 16's build without the mod counts).

| | chi-etag (3 builds) | rac-shadow-hide (4 builds) |
|---|---|---|
| Wall time | 18.8, **25.4, 37.0** min | 22.9, 27.9, **24.3, 24.1** min |
| Cost | $4.85, **$6.05, $8.83** | $5.30, $5.98, **$5.15, $4.88** |
| Outcome checks | all pass | all pass |
| Probes | 5/7, **7/7, 5/7** | nested target passes in all 4 |
| Audit would merge | yes, **yes, yes** (no must-fix) | no, yes, **yes, yes** (no must-fix) |

New builds in bold.

- **Quality held.** Every new build passes every outcome check, and the audit found no must-fix in any of the four. One chi-etag build missed the same two probes as section 15's (a garbage member in `If-None-Match`, a non-canonical `ETag` key).
- **React-aria's time is stable: 22.9–27.9 min.** Each build had one panel round, one fix round and a final gate. The implementor's first pass (6.6–7.0 min) is the largest step.
- **Chi-etag's time is not: 18.8–37.0 min.** The panel always finishes by minute 11. After that, the number of fix rounds decides the time:
  - The 25-min build had three fix rounds before its final gate. Each time it verified a fix, the request gatekeeper found a new difference from `net/http` in the fix itself, such as how `Write` rejects bytes past a declared `Content-Length`.
  - The 37-min build had three fix rounds before its final gate, and a fourth after it. The verifiers found regressions in the fixes: a failed `Hijack` sent the body twice, and late trailers were lost. In round 3 the orchestrator replaced the header-clone design with a simpler one. Then the fresh final gate found two more issues: a false 304 for HEAD behind `Compress`, and `Last-Modified` dropped from a 304.
  - Both are real bugs, and the build that took longest caught the most of them. The cost is time that can't be predicted.
- **The check cache barely matters on Go.** Agents' hits saved 0.5–2.9 min per chi-etag build and 0.2–1.3 min per react-aria build. The checks are fast, and the panel's checks mostly ran on trees no earlier run had seen.
- **Process checks still flag the same things.** Handoffs to the criteria-checker, simplifier and gatekeepers lack the `GOAL:` line, no stages are announced before the first spawn, and the orchestrator edits its own `criteria.md` in the scratchpad. The last is by design (criteria are the orchestrator's), so the check should allow scratchpad files. None of these affected the outcome.

What to take from it: expect 20–30 min on a typical task, longer when the change wraps something with many edge cases (`http.ResponseWriter`), because each fix round on such code tends to uncover the next edge case. A cap on fix rounds before the final gate (two, say, then let the final gate decide) would bound the time, at the risk of shipping something the third round would have caught.

### 19. Shipped in 0.3.0, without the extras

feature-flow-lite 0.3.0 ships the review panel (section 15) as the skill's flow, with the check cache opt-in (`FEATURE_FLOW_CHECK_CACHE=1`). The mod's extras (`FEATURE_FLOW_EXTRAS=1`) were removed:
- checks run ahead of the orchestrator, queued for a low-priority worker;
- base-commit checks in a worktree;
- the request and earlier must-fixes appended to gatekeeper handoffs;
- the `FOCUS: panel` fan-out;
- denying the orchestrator's edits to repo files;
- probe-file cleanup.

None showed a gain. Run eagerly they made react-aria 2–3× slower (section 15), and queued they only broke even (section 16). The handoff additions duplicated what the orchestrator already does: in 37 gatekeeper spawns before them, every handoff had the request word for word and the base commit. The `lite-review-panel-mod*` arms still set `FEATURE_FLOW_EXTRAS=1`; on 0.3.0 that does nothing, so rerunning them needs the code at `d8ea7b6` or earlier.

**The shipped skill, one build per task** (arm `lite-shipped-0.3`: the working-tree skill, the check cache on, heavy-limiter loaded):

| | chi-etag | rac-shadow-hide |
|---|---|---|
| Wall time, cost | 42 min, $6.99 | 35 min, $6.21 |
| Agents | investigator, criteria-checker, implementor, simplifier, 3 panel gatekeepers, final gatekeeper | the same |
| Report | `Mergeable: yes` | `Mergeable: yes` |
| Outcome checks (hidden tests, suites, lint, types) | all pass, Flush included | all pass |
| Probes | 6 of 7 | nested target passes |
| Audit would merge | no | no |

- **The flow loads and runs as written from the shipped files:** named agents, one panel round plus a final gate, and outcome checks all green on both tasks.
- **The audit found one must-fix in each, and both reports said `Mergeable: yes`.**
  - **chi-etag:** the doc comment says to put `ETag` outside `NoCache`. But `ETag` reads `If-None-Match` after the handler runs, and `NoCache` has deleted it from the request by then, so that order never returns 304. That is a docs-versus-code contradiction no gatekeeper probed.
  - **react-aria:** content in a shadow root created later around a kept-visible element (a non-modal popover inside a modal) is never hidden or watched.
- Against the panel's earlier 6 of 7 clean audits, 0 of 2 is within the noise of single builds, but neither gate is perfect.
- The check cache saved about 2.5 minutes on react-aria, mostly replayed `yarn check-types` runs.

### 20. The review panel on Haiku and on Sonnet (chi-etag, one build each)

These are the shipped 0.3 skill with every gatekeeper (the panel of three and the final gate) pinned to Haiku or Sonnet at high effort. The criteria-checker stays on Opus.

| | Haiku panel | Sonnet panel | Opus panel (section 18, plus the shipped build) |
|---|---|---|---|
| Wall time | 39 min | **15 min** | 19–42 min |
| Cost | $4.86 (orchestrator $4.02) | **$2.97** (orchestrator $1.97) | $4.85–8.83 |
| Gatekeeper verdicts | 12 (4 yes), 26 must-fixes, 4 fix rounds | 7 (4 yes), 4 must-fixes, 1 fix round | – |
| Outcome checks | all pass, Flush included | all pass, Flush included | all pass |
| Probes | 6 of 7 | 4 of 7 (`HeadServeContent`, `GarbageMember`, `NonCanonicalKey`) | 5–7 of 7 |
| Audit would merge | no: `If-None-Match: *` gets no 304 on a HEAD with no body | no: a HEAD gets an ETag of the empty body, which doesn't match GET's | 3 of 4 |

- **Haiku isn't cheaper.** Its gatekeepers raised 26 must-fixes over 12 verdicts, and the Opus orchestrator spent $4 handling them. The Haiku agents themselves cost $0.62.
- **Sonnet is the fastest and cheapest panel so far** (15 min, $2.97), but it caught the least: 4 must-fixes, the lowest probe score of any panel build, and a HEAD bug the audit found.
- **Both cheaper panels missed a HEAD case.** The Opus panel's chi-etag builds passed the audit in 3 of 4. One build each, so this is direction, not a result.

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
| `lite-review-gate`, `lite-review-gate-cache` | The `review-gate` variant (one Opus gatekeeper that reviews and decides, a criteria check before the implementor, the investigator started at once); the second arm sets `FEATURE_FLOW_CHECK_CACHE=1` through its `env` |
| `lite-review-panel`, `lite-review-panel-mod` | The `review-panel` variant (three gatekeepers at once by focus, batched fixes verified by `SendMessage`, a fresh final gate; check cache on, `SendMessage` allowed, session persistence kept), and `review-panel-mod`, the same plus `FEATURE_FLOW_EXTRAS=1` (base checks, checks ahead, request and `RULED ON` added to handoffs) |

The full feature-flow skill isn't in the tree any more, so its arms load it from history: an arm can pin any git `ref` of any skill `folder`, and the harness extracts that version with `git archive`. An arm can also lay a variant's files over the skill (`variant`: `harness/variants/<name>/`, which can replace SKILL.md or add and replace agents), pin every agent's model and effort or a single agent's (`agents`), set environment variables for its runs (`env`), and tell the grader which model every role should run on (`roster_model`). The skill's value claim is that `lite-v2` matches `baseline` on outcomes for no more money.

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
