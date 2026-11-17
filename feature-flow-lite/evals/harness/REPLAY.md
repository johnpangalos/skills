# Reviewer replay: the 0.2 reviewer vs the candidate-0.5 reviewer, on fixed diffs

Generated with `replay.py` (`select`, `rekey`, `triggers`, `run`, `score`). Raw data:
- `replay-set.json` lists the diffs.
- `replay-triggers.json` holds the Opus pick of triggered checks.
- `replay-runs/<diff>/<a|b>/rep-N/` holds each run's handoff, result and gzipped trace.
- `replay.json` holds the scores.

## Setup

- **Diffs.** 11 final diffs carry at least one keyed bug, 20 (diff, key) pairs across all six keyed hard tasks. 5 diffs are clean. The keys come from the deterministic probes (`probes/keys-round2.json`), applied after they landed (`replay.py rekey`). That moved chi-etag lite-shipped-0.2 rep 3 from clean to flush-bypass. It also added flush-bypass to the other two chi-etag diffs and took two judge-matched keys off one rac diff.
- **Clean diffs.** Only website-bookshop has builds with no confirmed defect from either judge, so it supplies two strictly clean diffs. chi-etag (lite-tests-first rep 3), risky-auth (lite-shipped-0.2 rep 1) and risky-refunds (lite-shipped-0.2 rep 3) supply the top-ranked builds with no keyed bug. Those three still have minor judge-confirmed defects. ui-lib has no clean diff: every build in these arms fails at least one probe.
- **Tree.** Each run used a fresh tree: `run.prepare()` for the scenario, then `git apply diff.patch`, uncommitted so `git diff` shows the change. The tree was reset between runs.
- **Handoff.** Each run used the build's first reviewer handoff from its trace (the full review, not the incremental round 2), with the workspace path rewritten.
- **Reviewers.** Both ran on Haiku at medium effort, with only the Read, Grep, Glob and Bash tools. The agent file's body was the system prompt and the handoff was the prompt. Each diff got 3 reps per reviewer.
  - **(a)** is `git show 9f82cef:feature-flow-lite/agents/reviewer.md`.
  - **(b)** is `variants/candidate-0.5/agents/reviewer.md`. Its handoff adds `TRIGGERED CHECKS:`, picked once per diff by one Opus call that follows step 6 of `variants/candidate-0.5/SKILL.md` and reads `references/checks.md`. The same text was used in every rep. For chi-etag it also adds `APPROVED DIFFERENCES: Flush must not send bytes before the response completes.`
- **Scoring.** The sonnet yes/no matcher from `recall.py` decided whether a finding describes the key, and whether that finding is tagged [blocking].

## Results

| | (a) 0.2 reviewer | (b) candidate-0.5 reviewer |
|---|---|---|
| Recall: a finding describes the keyed bug (60 = 20 diff-keys × 3 reps) | **6/60 (10%)** | **42/60 (70%)** |
| Blocking recall: that finding is [blocking] | 5/60 (8%) | 41/60 (68%) |
| [blocking] findings on the 5 clean diffs (15 runs) | 7 | 13 |
| …of which wrong (no defect in code or tests) | 2 (0.4 per diff) | 2 outright plus 4 "missing test" (1.2 per diff; 0.4 if a missing test counts) |
| Mean cost per review | $0.030 | $0.029, plus $0.20 per diff for the Opus trigger pick ($3.23 over 16 diffs) |

### Blocking recall per diff and key (reps out of 3)

| Diff | Key | (a) | (b) |
|---|---|---|---|
| chi-etag shipped-0.2 r2 | flush-bypass | 0 | 2 |
| chi-etag shipped-0.2 r2 | head-empty-etag | 0 | 2 |
| chi-etag shipped-0.2 r3 | flush-bypass | 0 | 3 |
| chi-etag reviewer-plus r5 | flush-bypass | 0 | 2 |
| chi-etag reviewer-plus r5 | head-empty-etag | 0 | 0 |
| rac shipped-0.2 r2 | nested-target-shadow | 1 | 1 |
| rac shipped-0.2 r4 | nested-target-shadow | 1 | 2 |
| rac shipped-0.2 r4 | shadow-host-target | 1 | 2 |
| rac shipped-0.2 r4 | yarn-lock | 0 | 2 |
| rac tests-first r2 | slot-aria-hidden | 1 | 2 |
| ui-lib shipped-0.2 r1 | focus-return-autofocus | 0 | 3 |
| ui-lib shipped-0.2 r1 | trap-hidden-content | 0 | 1 |
| ui-lib shipped-0.2 r5 | combobox-clear-null | 0 | 0 (1 found as [minor]) |
| ui-lib shipped-0.2 r5 | focus-return-autofocus | 0 | 1 |
| ui-lib shipped-0.2 r5 | nested-dialog-escape | 0 | 3 |
| ui-lib tests-first r4 | combobox-index | 0 | 3 |
| ui-lib tests-first r4 | focus-return-autofocus | 0 | 3 |
| ui-lib tests-first r4 | trap-hidden-content | 0 | 3 |
| risky-auth tests-first r1 | token-race | 0 (1 found as [minor]) | 3 |
| risky-refunds tests-first r5 | refund-race | 1 | 3 |

I read the (b) hits on flush-bypass, head-empty-etag, yarn-lock and focus-return-autofocus. Every one quotes a probe it ran and its output, for example `e3b0c442…` as the HEAD ETag, `YN0028` from `yarn install --immutable`, and focus landing on `<body>` after close. None merely restates the triggered check.

### Every [blocking] finding on the clean diffs, checked

I checked every [blocking] finding on the clean diffs. For each one I either reproduced it on the rebuilt tree or read the code.

| Diff | Reviewer, reps | Finding | Real? How checked |
|---|---|---|---|
| chi-etag tests-first r3 | a r1, a r2; b r1, b r3 | Hijack after a buffered Write drops the status line, headers and body. The client gets only the raw bytes. | **Real.** A Go probe over httptest.Server (`zz_verify_test.go`) gives `plain: "HTTP/1.1 200 OK…\|\|RAW"` and `etag: "RAW"`. |
| chi-etag tests-first r3 | a r3, b r2 | A trailer declared and set late also goes out as a header. | **Real.** Same probe: `plain header="" trailer="zz"`, `etag header="zz" trailer="zz"` (`finish` runs `maps.Copy(h, trailers)` before WriteHeader). |
| chi-etag tests-first r3 | b r1 | A Write after a successful Hijack returns nil, not `http.ErrHijacked`. | **Real.** Probe: plain gives `err=http: connection has been hijacked`, etag gives `err=<nil>`. |
| chi-etag tests-first r3 | b r3 | A 1xx written after a final 200 is forwarded. | **Real, but low impact.** It's a handler bug that net/http drops as superfluous. The probe shows `HTTP/1.1 103 Early Hints` ahead of the 200 with ETag. |
| risky-refunds shipped-0.2 r3 | a r2, a r3, b r1 | An object that spoofs `__class__ = Decimal` passes `isinstance`, then `Decimal(amount)` raises TypeError, not RefundError. | **Real, but contrived.** Running it gives `TypeError conversion from Fake to Decimal is not supported` (`shop/orders.py:62-64`). |
| risky-auth shipped-0.2 r1 | b r1, b r2, b r3 | No concurrent test in tests/test_auth.py. | **The code is right, and the test is missing as stated.** `grep -n -i thread tests/test_auth.py` finds nothing, and `redeem` holds `_LOCK` (`shop/auth.py:38`). The candidate prompt makes this [blocking] on purpose: "the diff needs a concurrent test of its own". |
| bookshop reviewer-plus r5 | a r1, a r2 | With JavaScript off, submitting the contact form navigates and puts the message in the URL. | **Wrong.** It reproduces (Playwright with JS off: `visit.html?name=Ada&email=Ada…`), but the request says "JavaScript is required, so it doesn't need to work with JavaScript turned off". |
| bookshop shipped-0.2 r3 | b r1 | The same JS-off form navigation. | **Wrong.** Same request line. This build also labels the form "Send message (demo)". |
| bookshop reviewer-plus r5 | b r1 | The test `events-are-chronological-and-upcoming` assumes at least 4 upcoming events on the real clock. | **Real, a test time bomb.** `js/data.js` has events on 2026-11-21, 2026-11-28, 2026-12-12, 2027-01-16 and 2027-02-13. After 2026-11-28 only 3 remain and `tests/run.mjs:500` fails. |
| bookshop reviewer-plus r5 | b r2 | No test for contrast or reduced motion. | **The code is right; a test is missing.** The reviewer's own probe found 0 contrast failures. |
| bookshop reviewer-plus r5 | b r3 | The hours table overflows at 360px with longer hours text. | **Wrong.** The shipped content fits (scrollWidth 360, by the reviewer's own check). It only overflows after the reviewer edits the content. |

On the "keyed-clean" diffs, the judges' minor notes didn't cover most of what the reviewers found. The chi-etag hijack and trailer bugs are real and none of the judges listed them.

## Caveats

- **(b)'s replay is in-sample.** The "From" lines in `references/checks.md` were written from these exact keyed bugs, for example "ETags computed from the empty body of HEAD responses", "builds that added a dependency without updating yarn.lock" and "comboboxes that tracked the active option by index". On chi-etag, the `APPROVED DIFFERENCES:` line states the flush-bypass key almost word for word. So 70% against 10% measures how well a briefed Haiku reviewer acts on a pointer to the bug. It doesn't measure recall on bugs nobody has seen yet. The 4 held-out tasks in the candidate builds are the real test.
- **The briefing matters more than the prompt body.** (a) and (b) share most of the body. The difference is the triggered checks and the approved differences. Still, (b) missed head-empty-etag on chi-etag reviewer-plus r5 in all 3 reps, and caught combobox-clear-null only once, as [minor]. A trigger alone isn't enough when the probe is subtle.
- **Missing tests raise (b)'s false-blocking rate.** On clean diffs it reports more [blocking] findings, 13 against 7. 4 of the 13 say a test is missing while the code is correct. That is what its prompt asks for, but in the fix loop each would cost a fix round.
- **Cost.** Each review costs about the same ($0.03). (b)'s real extra cost is the Opus trigger pick at about $0.20 per diff. In the skill that pick is part of the orchestrator's turn, so it would be cheaper there than a standalone call.
- **3 reps per cell.** A difference of one rep in a cell is noise.
