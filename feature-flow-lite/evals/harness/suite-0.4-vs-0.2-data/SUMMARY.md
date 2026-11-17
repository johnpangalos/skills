# 0.4 vs 0.2 on 14 build tasks (2026-11-16)

Same day, same harness, 3 builds per version per task: 84 builds in all. `lite-shipped-0.2` is the skill at `9f82cef`; `lite-shipped-0.4` is the working tree at `27a66d5`. The two arms are set up as each version was benchmarked before: 0.4 also loads heavy-limiter and sets `FEATURE_FLOW_CHECK_CACHE=1`, while 0.2 has neither. That changes wall-clock time, not what gets built.

Run on 7 cloud sessions with 4 CPUs each, two builds at a time. Each was graded with outcome checks (hidden tests, suites, lint and types), probes where a task has them, and `audit.py` (a read-only Opus maintainer that decides whether it would merge). There's no blind judging yet. The anonymized copies are on the `slice-N` worker branches as `ff-judge-N.tar.gz`.

| Task | 0.2 outcome | 0.4 outcome | 0.2 audit merge | 0.4 audit merge | 0.2 $ | 0.4 $ | 0.2 min | 0.4 min |
|---|---|---|---|---|---|---|---|---|
| chi-etag | **0/3** | **3/3** | 3/3 | 2/3 | 1.12 | 2.76 | 13.3 | 15.4 |
| chi-mount-routes | 3/3 | 3/3 | 3/3 | 3/3 | 0.83 | 0.83 | 10.6 | 3.7 |
| click-duration | 3/3 | 3/3 | 2/3 | 3/3 | 1.20 | 1.89 | 8.9 | 7.3 |
| click-param-spec | 3/3 | 3/3 | 3/3 | 2/3 | 1.27 | 2.98 | 9.9 | 11.9 |
| fd-count | 3/3 | 3/3 | 3/3 | 3/3 | 0.86 | 2.44 | 7.1 | 10.3 |
| tailwind-anchor | 3/3 | 3/3 | 3/3 | 3/3 | 0.82 | 1.97 | 7.9 | 7.9 |
| rac-shadow-hide | 2/3 | 2/3 | 2/3 | 2/3 | 1.14 | 3.59 | 16.8 | 22.5 |
| ui-lib | 3/3 | 3/3 | **0/3** | **2/3** | 1.43 | 3.33 | 14.8 | 20.6 |
| website-bookshop | 3/3 | 3/3 | **1/3** | **3/3** | 1.17 | 2.84 | 18.7 | 16.0 |
| discount-codes | 3/3 | 3/3 | 3/3 | 3/3 | 0.71 | 0.86 | 4.1 | 2.5 |
| reset-token-expiry | 3/3 | 3/3 | 3/3 | 3/3 | 0.54 | 0.37 | 3.3 | 1.2 |
| risky-auth | 3/3 | 3/3 | 3/3 | 3/3 | 0.55 | 0.54 | 2.8 | 1.5 |
| risky-inventory | 3/3 | 3/3 | 3/3 | 3/3 | 0.66 | 1.25 | 4.2 | 7.9 |
| risky-refunds | 3/3 | 3/3 | 3/3 | 3/3 | 0.80 | 1.46 | 5.8 | 5.2 |
| **All 42** | **38/42** | **41/42** | **35/42** | **38/42** | **0.94** | **1.94** | **9.2** | **9.6** |

## What it shows

- **0.4 costs about 2.1× as much as 0.2 per build** ($1.94 against $0.94 on average, $81 against $39 for the 42 builds), and takes about the same time on average.
- **Where 0.4 is better:**
  - On chi-etag, every 0.2 build fails the hidden `TestFlushDoesNotBypassTheBuffer` and every 0.4 build passes it.
  - On the UI and site tasks (ui-lib, website-bookshop), the audit would merge 5 of 6 0.4 builds against 1 of 6 for 0.2.
- **Where they tie:** the other 11 tasks, within the noise of 3 builds. 0.2 has the cleaner audit on click-param-spec and chi-etag, and 0.4 on click-duration. On 7 of the 14 tasks (fd-count, tailwind-anchor, click-param-spec, rac-shadow-hide and the shop package's discount-codes, risky-inventory and risky-refunds), 0.4 costs 1.2–3.2× as much for the same result.
- **0.4 doesn't always run its own flow.** In 10 of its 42 builds the main thread skipped most of it: no criteria check, panel or simplifier, and sometimes no implementor, with the orchestrator editing the code itself and one gatekeeper approving it. The 10 are chi-mount-routes (3 of 3), reset-token-expiry (3), risky-auth (2), discount-codes (1) and risky-inventory (1). All 10 passed every outcome check and the audit. These are the small tasks, which is why 0.4 is cheaper or level on them. 0.2 ran its investigator, implementor, reviewer and simplifier in all 42 builds, except the investigator on ui-lib and website-bookshop, which 0.4 also skipped.
- **Outcome misses:**
  - 0.2: the 3 chi-etag builds (Flush), plus 1 rac-shadow-hide build.
  - 0.4: 1 rac-shadow-hide build.
  - Both rac misses fail the type check on `TS2300 Duplicate identifier 'JSX'` in `node_modules/@mdx-js/react`. That's the install side effect section 21 already saw, not the change.

## Caveats

- 3 builds per version per task. Differences of one build either way are noise.
- Clone race: on a cold `~/.cache/ff-evals`, two parallel setups of the same repo collide in `setup_repo.sh` / `setup_tailwind.sh` / `setup_react_spectrum.sh`. 9 builds failed setup before `claude -p` started: tailwind 3, chi-etag 2, chi-mount-routes 2 and fd-count 2. Each was rerun once on the warm cache and passed setup. The reruns are marked in their `meta.json`. Slice 1 restarted its whole batch after warming the cache.
- `hidden_cases.py` only parses Python unittest output, so its per-case output reads "(import)" for Go, Rust, JS and pytest tasks. The outcome columns above come from `grade.py`'s hidden checks. Slices 5 and 7 also saved per-case counts from each task's own runner.
- Process checks in `grade.py` still expect a `reviewer` role, so 0.4's gatekeepers fail them. Those don't count in the tables above.

`runs.json` has one row per build: outcome pass, failing checks, audit verdict and must-fix count, cost, wall time, the roles spawned, and whether it's a rerun.

# Three setups, blind-judged (added the same day)

A third arm, `lite-0.2-criteria` (0.2 plus 0.4's Opus criteria-checker before the implementor; `harness/variants/criteria-check-0.2/`), ran on all 14 tasks, 3 builds each. Then every task's 9 builds were pooled under fresh shuffled letters and blind-judged: one inspector per build, then 2 judges ranking all 9 on one scale (`judge/combine.py`, `judge/prep_final.sh`, `judge/plan.tsv`). Inspector reports from an earlier 0.2-vs-0.4 pass were carried over for 8 tasks, with their letter references rewritten. Results are in `judge/final-f*.json` and are unblinded with `judge/remap-<task>.json`. Everything is also in D1 (`runs` and `judge_scores`; see `../store/README.md`).

| Across 14 tasks, 42 builds each | 0.2 | 0.2 + criteria-checker | 0.4 |
|---|---|---|---|
| Passed every outcome check | 38 | 39 | 41 |
| Audit would merge | 35 | 32 | 38 |
| Mean judge score (2 judges × 42 builds) | **7.71** | 7.51 | 7.41 |
| Mean cost per build | **$0.94** | $1.27 | $1.94 |
| Mean time per build | 9.2 min | 11.0 min | 9.6 min |

Mean judge score per task (average of both judges over the 3 builds):

| Task | 0.2 | 0.2 + criteria-checker | 0.4 |
|---|---|---|---|
| chi-etag † | 8.00 | 7.17 | **8.25** |
| chi-mount-routes | 7.82 | **8.13** | 7.30 |
| click-duration | **8.17** | **8.17** | 7.83 |
| click-param-spec ‡ | **7.83** | 7.62 | 7.80 |
| discount-codes | **8.27** | 8.25 | 7.77 |
| fd-count † | 8.05 | **8.22** | 7.93 |
| rac-shadow-hide | 5.83 | 5.25 | **7.67** |
| reset-token-expiry | 7.75 | **7.83** | 6.83 |
| risky-auth | **7.83** | 7.33 | 6.67 |
| risky-inventory | **8.38** | 7.85 | 7.63 |
| risky-refunds | **7.62** | 7.10 | 6.03 |
| tailwind-anchor | 7.67 | **7.92** | 7.33 |
| ui-lib | 7.08 | 6.58 | **7.92** |
| website-bookshop | **7.67** | **7.67** | 6.83 |

† The judges and the hidden tests disagree. On chi-etag, the hidden `TestFlushDoesNotBypassTheBuffer` passes for 0 of 3 0.2 builds, 2 of 3 criteria-checker builds and 3 of 3 0.4 builds. The judges ran only the repo's own tests, and one of them credited a 0.2 build because "Flush really streams", which the request rules out. On fd-count, one criteria-checker build fails the hidden flag-conflict test, and the judges scored it 8.3 anyway.
‡ The two judges disagreed on whether to move `get_help_spec` literally as the request says, or to keep `--help` overrides working. One rewarded the literal builds and the other penalised them.

## What it shows

- **Plain 0.2 is the best value.** It has the highest mean judge score at the lowest cost, and it leads or ties on 7 of 14 tasks.
- **0.4's review panel pays off on deep behaviour.** It wins on rac-shadow-hide (nested shadow roots, 7.67 against 5.83) and ui-lib (Dialog and Combobox behaviour, 7.92 against 7.08), and on chi-etag by the hidden test.
- **0.4 loses in three places:**
  - Concurrency. On risky-refunds, 0 of 3 0.4 builds lock the refund path, against 2 of 3 for each 0.2 setup.
  - Product polish. On website-bookshop it has the plainest sites, even though the audit would merge all three.
  - Tasks where its orchestrator skips its own flow (chi-mount-routes, reset-token-expiry), which leaves thinner tests and docs.
- **The criteria-checker fixes misread requirements, not behaviour.** It wins on chi-mount-routes (the only builds that reported the mount's wildcard route), tailwind-anchor and fd-count, and recovers 2 of 3 chi-etag Flush passes. It doesn't help on ui-lib, rac-shadow-hide or website-bookshop. It costs about $0.33 more per build than 0.2.
- **The checks miss real bugs.** The judges reproduced races on risky-refunds and risky-auth that every hidden test and audit had passed. Those hidden tests need stress cases.

## Caveats

- 3 builds per setup per task. A difference of about 0.5 points on one task is within noise. The suite-wide means are steadier, but they're one day's builds.
- Judges and hidden tests measure different things (see † and ‡). Read the judge column together with the outcome checks, not instead of them.
- One blind mapping had a wrong rep number: the chi-etag 0.2 rerun in slice-5 was recorded as rep 2 instead of rep 3. It's fixed in `slice-5/blind-mapping.json` and `judge/remap-chi-etag.json`.

# Five setups, round 2 (2026-11-17)

Two more arms, both on 0.2 at `9f82cef`:
- `lite-reviewer-plus` (`harness/variants/reviewer-plus/`): the Haiku reviewer gets a fixed set of probes — wrappers against the unwrapped original, nesting, driving built UI, and 8+ threads on shared state.
- `lite-tests-first` (`harness/variants/tests-first/`): the implementor writes a failing test for every criterion and hostile input before any code, and the reviewer blocks on a missing test.

They ran 5 builds each on the 6 hard tasks and 2 each on 4 easy ones. 0.2 and 0.4 got 2 top-up builds on the 6 hard tasks, so they also have 5 there. risky-auth and risky-refunds gained hidden stress tests that force a thread switch on every line (`hidden/*/_interleave.py`).

Each task's builds were pooled again under fresh letters with the round-1 builds (13 or 23 per task) and blind-judged (`judge/plan2.tsv`, `judge/prep_round2.sh`). Results are in `judge/round2-g*.json`, unblinded with `judge/remap2-<task>.json`. D1 holds them as `judge_scores.pass = 'round2'` (`store/judge_sql.py <suite> <dir> round2`).

Across the 10 tasks every setup ran:

| | 0.2 | 0.2 + criteria-checker | reviewer-plus | tests-first | 0.4 |
|---|---|---|---|---|---|
| Builds | 42 | 30 | 38 | 38 | 42 |
| Mean judge score (task-balanced) | 7.48 | 7.32 | 7.47 | **7.70** | 7.35 |
| Mean cost per build | **$1.00** | $1.29 | $1.04 | $1.07 | $2.18 |
| Outcome checks pass (not counting stress tests) | 34/42 | 27/30 | 28/38 | 31/38 | **39/42** |
| Stress tests pass (risky-auth + risky-refunds, 5 builds each) | 6/10 | – | **8/10** | 4/10 | 2/10 |
| chi-etag hidden Flush test | 0/5 | 2/3 | 0/5 | 1/5 | **5/5** |
| rac: target nested in another target's shadow root | 2/5 | 0/3 | 1/5 | 4/5 | **5/5** |

Mean judge score per task (both judges, all builds in the pool):

| Task | 0.2 | criteria | reviewer-plus | tests-first | 0.4 |
|---|---|---|---|---|---|
| chi-etag † | **8.13** | 6.97 | 7.36 | 8.02 | 7.98 |
| chi-mount-routes | 7.97 | **8.13** | 7.65 | 8.00 | 7.22 |
| discount-codes | **8.43** | 8.32 | 8.15 | **8.43** | 7.90 |
| fd-count | 8.00 | 7.92 | 7.75 | **8.50** | 7.75 |
| rac-shadow-hide | 5.95 | 5.42 | 6.10 | 7.05 | **7.65** |
| risky-auth | 6.95 | 6.75 | **8.00** | 6.35 | 6.10 |
| risky-refunds | **7.56** | 7.27 | 7.04 | **7.56** | 6.46 |
| tailwind-anchor | 7.50 | 7.67 | 8.25 | **8.38** | 7.08 |
| ui-lib | 6.70 | 6.73 | 6.98 | 7.11 | **8.03** |
| website-bookshop | 7.59 | **7.98** | 7.45 | 7.61 | 7.33 |

† Both judges rewarded builds that stream on Flush, which the request rules out and the hidden test checks. Read chi-etag by the Flush row above.

## What it shows

- **tests-first is the best cheap setup.** It has the highest judge mean at about 0.2's cost, wins or ties 4 of 10 tasks, and is second to 0.4 on both deep-behaviour tasks (rac 7.05, ui-lib 7.11).
- **Its weak spot is races.** Writing tests first doesn't make anyone write a concurrent test: 0 of 5 risky-auth builds pass the stress test.
- **reviewer-plus fixes races and little else.** Its shared-state probe gives the best stress result (8/10) and the clear risky-auth win. Its wrapper, nesting and UI probes did not move chi-etag, rac or ui-lib. On risky-refunds the orchestrator twice dropped a reproduced race, which `reviewer-plus-2` (not run yet) forbids.
- **0.4 still wins deep behaviour, at about twice the cost.** It wins chi-etag Flush 5/5, rac nesting 5/5 and ui-lib, and has the most outcome passes. It loses races (2/10) and polish. Its two ui-lib top-up builds fail the hidden accessibility tests, even though the judges ranked them high.
- **The criteria-checker didn't earn its cost here.** It's last on the judge mean.
- **Next candidate:** tests-first plus the reviewer-plus-2 reviewer and rule. That combines tests-first's behaviour coverage with the probe that catches races, at about $1.10 a build.

## Caveats

- 2–5 builds per setup per task. Gaps of about 0.5 on one task are noise, and the 4 easy tasks have only 2 new builds per arm.
- The stress tests were added after 0.2, criteria and 0.4's first 3 builds were graded. For those builds, the stress row comes from running the stress tests afterwards. reviewer-plus and tests-first come from their own grading (`newarms-5`, `newarms-6`). tests-first fails all 5 on risky-auth and 1 on risky-refunds. The outcome row leaves stress out so all arms are counted the same way.
- 10 `lite-routed` builds on risky-auth and risky-refunds were made before routing was dropped. They're in D1 but weren't judged.

# Round 3: candidate-0.5 against 0.2 (2026-11-17)

`lite-candidate` (`harness/variants/candidate-0.5/`) is 0.2 with these changes:
- tests-first;
- the no-downgrade fix-loop rule from reviewer-plus-2;
- a diff-triggered checklist (`references/checks.md`, 10 items, each with a trigger, a check and the miss it came from) that the orchestrator copies to the implementor and the reviewer;
- `APPROVED DIFFERENCES` for wrappers.

It ran 54 builds: 5 on each of the 6 hard tasks and 3 on each of the other 8, including 4 tasks the checklist wasn't drawn from (click-duration, click-param-spec, reset-token-expiry, risky-inventory). They were blind-judged in pools with the existing 0.2 builds, whose round-1 or round-2 inspector reports were carried over (`judge/prep_round3.sh`, `plan3.tsv`, `round3-h*.json`, `remap3-*.json`).

Known bugs are now scored with deterministic answer-key probes (`probes/keys.json`, `probes/*/probe.sh`), which were validated against the round-2 judges (`probes/VALIDATION.md`). Every disagreement checked by hand went to the probe. The race stress tests aren't flaky: each of 46 builds × 10 runs was 0/10 or 10/10.

| Task | 0.2 judge | candidate judge | 0.2 $ | candidate $ | Keyed bugs / hidden checks, 0.2 → candidate |
|---|---|---|---|---|---|
| chi-etag † | **8.20** | 7.20 | 1.16 | 1.88 | Flush bypass 5/5 → **0/5**; HEAD empty ETag 1/5 → 0/5 |
| rac-shadow-hide | 5.55 | **7.30** | 1.22 | 1.76 | nested target 3/5 → **0/5**; stale yarn.lock 2/5 → 0/5 |
| ui-lib | 6.70 | **8.25** | 1.39 | 1.70 | bugs per build 2.6 → **1.0** (only the display:none trap case is left) |
| website-bookshop | 7.43 | **7.82** | 1.36 | 1.48 | – |
| risky-auth | 6.77 | **7.98** | 0.53 | 0.78 | stress race 3/5 → **0/5** |
| risky-refunds | 7.45 | 7.55 | 0.83 | 1.05 | stress race 1/5 → **0/5** |
| discount-codes | 8.03 | **8.35** | 0.71 | 0.81 | 1 → 0 |
| chi-mount-routes | 8.00 | **8.33** | 0.83 | 1.29 | 3 → 4 (mount wildcard everywhere) |
| tailwind-anchor | 7.25 | **7.83** | 0.82 | 0.81 | 1 → 0 |
| fd-count | **8.15** | 7.75 | 0.86 | 1.11 | hidden tests 3/3 → **1/3** (the usage error names flags the user didn't pass) |
| click-duration ‡ | 7.67 | 7.75 | 1.20 | 1.48 | hidden tests 3/3 → 2/3 (missed changelog entry) |
| click-param-spec ‡ | **8.17** | 7.58 | 1.27 | 1.54 | – |
| reset-token-expiry ‡ | 7.08 | **7.83** | 0.54 | 0.86 | judges reproduced a race in 3/3 0.2 builds and 0/3 candidate builds |
| risky-inventory ‡ | **8.17** | 7.83 | 0.66 | 0.91 | – |
| **Mean over 14 tasks** | 7.47 | **7.81** | 0.96 | 1.25 | |

† The judges rewarded compact builds and didn't probe Flush, which the request rules out. The hidden Flush test decides chi-etag: candidate 5/5, 0.2 0/5.
‡ Held out: the checklist wasn't drawn from these tasks. Mean: 0.2 7.77, candidate 7.75.

## What it shows

- **The candidate beats 0.2 on 10 of 14 tasks**, by 0.34 on the mean, for about 30% more per build ($1.25 against $0.96; 0.4 was $1.94).
- **On the bugs the checklist names, it matches or beats 0.4 at about half the cost.** The Flush bypass, the nested shadow-root target, ui-lib focus return and the races in risky-auth and risky-refunds each drop to zero. The implementor's own tests catch them first: every shared-state build added a concurrent test, and the approved difference for chi-etag spelled out that Flush must not send early.
- **On the held-out tasks it's level** (7.75 against 7.77), with one real generalisation. On reset-token-expiry, which no hidden test checks for races, every candidate build locks and no 0.2 build does.
- **What it costs:**
  - About 30% more per build. Fix rounds went over the cap of two in several builds.
  - Over-building where no check applies. The judges marked down heavy tests, frame-inspection heuristics and decimal-context machinery on click-param-spec, risky-inventory, risky-refunds and chi-etag.
  - The fd-count usage-error regression.
- **Review is still where bugs are lost.** On the earlier builds, 66 of 83 shipped keyed bugs were never flagged by a reviewer, the orchestrator dropped 12 found ones, and 5 fixes failed (`../RECALL.md`). Replayed on fixed diffs, the 0.2 reviewer found 10% of keyed bugs and the candidate reviewer 70% (`../REPLAY.md`). That 70% is in-sample, because the checklist names those bugs.

## Next

- **Keep:** tests-first, triggered checks and approved differences.
- **Fix in the wording:**
  - Copy the checks word for word, and pass them to fix rounds too.
  - Hold the two-round cap.
  - A test that can't fail is [blocking], not [minor].
  - Add a proportion line for the implementor: "no machinery the criteria don't need", aimed at the over-building.
- **Check the fd-count case** before shipping: is the "conflicting flags give an error" item pushing builds toward clap ArgGroups?
- **Grow the checklist only from recurring misses**, and keep held-out tasks to catch overfitting.

# Round 4: candidate-0.5b and 0.5c (2026-11-17)

`candidate-0.5b` is 0.5 with five changes:
- triggered checks copied word for word into every handoff, fix rounds included;
- a hard cap of two fix rounds, counting every implementor call after the first;
- a test that can't fail is [blocking];
- a proportion rule for the implementor;
- new conflicts and registrations are declared on the new thing, not added to shared groups.

`candidate-0.5c` is 0.5b plus a mod that enforces the same rules from outside the prompt. It:
- restores triggered checks a handoff drops, and adds the exact text of any check that was paraphrased;
- carries the reviewer's blocking findings into the next implementor handoff;
- escalates a [minor] finding that says a test can't fail;
- notes the last fix round;
- notes when the main thread edits repo files itself.

0.5b ran 3 builds each on the six tasks the changes should move most. 0.5c ran 3 each on chi-etag, risky-auth and risky-refunds. They were blind-judged in one pool per task with the round-3 0.2 and 0.5 builds (`judge/prep_round4.sh`, `plan4.tsv`, `round4-k*.json`, `remap4-*.json`).

| Task | 0.2 | 0.5 | 0.5b | 0.5c | Hidden tests, answer keys and cost |
|---|---|---|---|---|---|
| chi-etag † | **8.10** | 7.15 | 7.25 | 7.25 | Flush: 0.2 0/5, every candidate passes. Cost: 0.5 $1.88, 0.5b $1.70, 0.5c $1.95 |
| ui-lib | 6.75 | **8.15** | 8.00 | – | Keyed bugs per build: 0.2 2.6, 0.5 1.0, 0.5b 0.67 |
| risky-refunds | 7.50 | 7.10 | 7.83 | **7.92** | Stress test 3/3 for each candidate. Cost: $1.05 → $0.85 (0.5b) |
| risky-auth | 6.85 | **7.90** | – | 7.57 | 0.5c builds all lock, but accept NaN timestamps |
| risky-inventory | **8.03** | 7.63 | **8.02** | – | Tests 0.5: +420 lines, 0.5b: +306 |
| click-param-spec | **8.33** | 7.50 | 7.50 | – | Frame-walking heuristics remain |
| fd-count ‡ | **8.13** | 7.78 | 7.40 | – | Hidden tests: 0.5 1/3, 0.5b 3/3 (none edits the shared `execs` group) |
| Mean, the six 0.5b tasks | 7.81 | 7.55 | 7.67 | | |

† The judges didn't probe Flush. ‡ The judges marked down two 0.5b builds for an error on a broken pipe, and didn't run the hidden conflict-message test.

These six tasks were picked because 0.5 was weak on them, so 0.2 leading here doesn't overturn round 3, where 0.5 led 0.2 by 0.34 over all 14 tasks.

## What it shows

- **0.5b keeps every correctness gain and trims Python over-building.** Refunds rose 0.73 and inventory 0.39. The fd-count regression is fixed. It's cheaper than 0.5 on four of six tasks.
- **It doesn't trim over-building in Go or click.** Judges still mark down net/http emulation, meta-tests that read the README, and frame-walking heuristics.
- **The cap held everywhere.** No 0.5b or 0.5c build ran a third fix round. But the second round is never re-reviewed, and audit must-fixes on chi-etag and ui-lib came in with those last fixes.
- **The mod made no measurable difference.** In every 0.5c build the orchestrator already sent blocking findings, stopped at the cap and escalated weak tests, because SKILL.md says to. The builders' audit of the mod found three bugs, all fixed with tests (52 pass):
  - the checks rewrite could delete the orchestrator's own text, so it now only adds;
  - the main-edit note could never fire in `/tmp` workspaces;
  - background agents hid results from it.

## Next

Ship 0.5b plus the fixed mod as 0.5, with these open:
- a final re-review after the last fix round that reports instead of looping;
- a proportion rule that names meta-tests and emulation layers;
- NaN handling under the money and numbers check.

# Round 5: candidate-0.5c rerun with the fixed mod (2026-11-17)

The round-4 0.5c builds ran with three mod bugs, so the mod could barely act:
- background agents hid results from it;
- its main-edit note couldn't fire in `/tmp` workspaces;
- its checks rewrite could delete the orchestrator's text.

After fixing those (`cd8fbad`, `3489e9a`) and adding a log line for every delivered note (`6d749d5`), 0.5c ran again: 3 builds each on chi-etag, risky-auth and risky-refunds. Those builds were blind-judged in the round-4 pools (`judge/prep_round5.sh`, `plan5.tsv`, `round5-m*.json`; remap `source` `c2` marks the rerun).

| Task | 0.2 | 0.5 | 0.5b | 0.5c, first mod | 0.5c, fixed mod |
|---|---|---|---|---|---|
| chi-etag | 8.05 | 7.20 | 7.25 | 7.42 | 7.75 |
| risky-refunds | 7.61 | 7.43 | 7.90 | 7.82 | 7.43 |
| risky-auth | 6.80 | 8.10 | – | 7.58 | 7.67 |
| Mean | 7.49 | 7.58 | – | 7.61 | 7.62 |

Outcomes for the fixed-mod builds:
- 8/9 pass every outcome check, including every race stress test.
- One chi-etag build fails the hidden Flush test. Its orchestrator wrote the approved difference as "held until the handler returns (or first Flush)", so the criteria were wrong before any code was written. It's the only one of 14 judged candidate chi-etag builds to do this.

## What the fixed mod did

- **The last-fix-round note:** delivered in 6 builds, 3 of them on background launches. The orchestrator never called the implementor again. Twice it ran one more review and reported that review's findings as open.
- **The can't-fail escalation:** fired once. The finding went to the implementor, labelled "[blocking, a test can't fail]".
- **Carrying findings:** fired once, redundantly, because the orchestrator had listed them under "FINDINGS TO FIX:". That's fixed in `d2b9f60` (54 mod tests pass).
- **Exact-check additions and restored blocks:** none needed. Every handoff already had them.
- **False positives:** none, apart from the redundant findings above.

## What it shows

- **The fixed mod works mechanically, but doesn't change quality.**
  - Its notes reach the orchestrator, including on background agents, and the orchestrator follows them.
  - In most builds the orchestrator was already counting rounds and carrying findings, because SKILL.md says to. The notes back that up rather than cause it.
  - Its mean over the three tasks (7.62) is level with the first mod (7.61) and with 0.5 (7.58). The task-by-task swings are within noise for 3 builds.
- **The approved differences are only as good as the orchestrator's reading of the request.** Without 0.4's Opus criteria-checker, a misread of Flush can still slip through, though rarely (1 of 14 builds).

## Recommendation

Ship 0.5 as candidate-0.5b's SKILL.md, agents and references, plus the fixed mod from candidate-0.5c. The mod is cheap, never deletes, and guards the rules on runs where the orchestrator drifts. It doesn't raise scores.

Open items:
- a re-review after the last fix round that reports instead of looping;
- a proportion rule that names meta-tests and emulation layers;
- NaN under the money and numbers check;
- a check of approved differences against the request's own words.
