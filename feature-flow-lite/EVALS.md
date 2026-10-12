# feature-flow-lite: what the evals found

A summary of every eval run on feature-flow-lite and its Figma offshoots so far. How to run them is in [`evals/README.md`](evals/README.md).

Unless a section says otherwise, every build was judged blind: one inspector per build, then two independent judges per task ranking all of that task's builds on one 1–10 scale. Every skill setup runs the main session on Opus at medium effort. Scores from different judging passes aren't comparable, so each table below compares setups only within itself.

## The short version

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
- **On websites, plain Opus still builds the best-looking product**, but it barely tests it. That pattern holds on every task so far.
- **For Figma component work the pipeline doesn't pay.** With an exact-value test in the repo, plain Opus or plain Sonnet matched every value at a fraction of the cost. figma-flow now builds directly.
- **Noise is large.** About 0.9 points of spread per build means 3 builds per setup can only show gains of roughly half a point or more. Several early leads disappeared on a re-run.

## Timeline

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

## Tasks

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

The first six are "the benchmark" below.

## 1. Subagent model (round 5)

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

## 2. Sibling criteria and hostile inputs (v3)

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

## 3. v4: tuning on probes

The judges' notes became 25 scripted probes, which let changes be iterated on cheaply. v4 added four changes: wrappers forward every optional interface, the repo's full check set, wider hostile inputs, and an Opus final read of the whole diff.

| | Old skill | v3 | v4 | Plain Opus |
|---|---|---|---|---|
| Probes passed | 73% | 75% | **89%** | 70% |
| Benchmark judge score | 7.52 | 7.60 | **8.04** | 7.39 |
| Spread (sd per build) | 1.10 | 0.79 | **0.33** | 1.11 |
| Unseen tasks (2) | 7.77 | **8.05** | 7.84 | 7.18 |

- The gain sat on the tasks the probes came from: chi-etag went from 6.17 to 7.83, and click-duration from 7.50 to 8.50.
- On unseen tasks v4 tied v3. It was not shipped, though the Opus final read was later folded into the skill.

## 4. New project types and the red-team reviewer (v5)

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

## 5. More reviewers and Opus triage (v6 to v8)

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

## 6. Prompting lessons (v9)

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

## 7. The mod

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

## 8. Per-repo project file

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

## 9. Figma to React

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

## Trigger evals

Eight `claude plugin eval` cases: four should fire the skill, and four are near-misses that shouldn't. The last run fired on 11 of 12 should-trigger runs and on none of the 12 near-miss runs, for $4.42.

## Open questions

- Does v5 plus the screenshot reviewer alone (without v9's verify paragraph) keep the product gain and the tests?
- Does a second run that reads an existing `FEATURE_FLOW.md` do better than the first?
- Is a pipeline worth it for a page-sized Figma design?
- Does any gain this size hold at 5+ builds per setup? Most measured effects are within the noise of 3 builds.

## Raw data

Reports and raw judging live in the project's shared folder (`feature-flow-models/`): `report.md`, `old-vs-new-report.md`, `v4-report.md`, `new-project-types-report.md`, `mod-report.md`, `project-file-report.md` and `raw/`. Round 4's traces, diffs and gradings are attached to the `feature-flow-lite-v1` release.
