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
