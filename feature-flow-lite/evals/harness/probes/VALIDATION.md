# Answer-key probes vs the round-2 judges

Each `probes/<task>/probe.sh` reports the `probes/keys.json` ids of the keyed bugs it reproduces.
This file compares those ids with what both round-2 blind judges confirmed
(`suite-0.4-vs-0.2-data/judge/round2-g*.json`, `confirmed_defects`) for every build in the round-2
pools (rebuilt with `judge/prep_round2.sh`. rac-shadow-hide trees were rebuilt as BLIND-NOTE.md
says: react-spectrum b8f8d1d plus `git apply --exclude='bin/*' <L>.diff`).

How it was compared: each judge finding was matched to a key id by a pattern on its text (for
example `yarn\.lock`, `index-based`, `-\$0\.00`), then compared per task, letter and key.
**agree** means the probe and at least one judge say the same thing, either bug or no bug.
**probe-only** and **judge-only** are the disagreements. Every disagreement below was checked by hand
against the build. Letters are the round-2 pool letters (`judge/remap2-<task>.json`). Per-build
results are in `keys-round2.json`.

To rerun: `python3 probes/run_probes.py --blind /tmp/ffj/final2 suite-0.4-vs-0.2-data/judge/remap2-*.json --keys probes/keys-round2.json`.
Two full runs over all 176 builds gave identical output.

## Agreement table

| Task | Builds | Keys | Agree (bug / no bug) | Probe-only | Judge-only |
|---|---|---|---|---|---|
| chi-etag | 23 | 2 | 31 (5 / 26) | flush-bypass: A B C D F H I J K M P Q S V W | – |
| rac-shadow-hide | 23 | 4 | 92 (21 / 71) | – | – |
| ui-lib | 23 | 5 | 115 (53 / 62) | – | – |
| risky-auth | 23 | 1 | 23 (14 / 9) | – | – |
| risky-refunds | 23 | 1 | 23 (9 / 14) | – | – |
| discount-codes | 13 | 2 | 25 (13 / 12) | negative-zero: L | – |
| chi-mount-routes | 13 | 2 | 22 (10 / 12) | mount-wildcard: H J | mount-wildcard: K L |
| tailwind-anchor | 13 | 2 | 26 (3 / 23) | – | – |
| fd-count | 13 | 2 | 23 (8 / 15) | zsh-completion: J | write-error-silent: G H |

Agreements that only one judge shares: ui-lib focus-return-autofocus (judge 0 on all 17
probe-failing builds; judge 1 reproduced it only partly on Q) and trap-hidden-content on T
(judge 1); discount-codes negative-zero on J (judge 1); chi-mount-routes mount-wildcard on A–G
and M (judge 0). Hand checks agreed with the probe in each case.

## Disagreements, checked by hand

### chi-etag

- **flush-bypass, A B C D F H I J K M P Q S V W (probe-only). The probe is right.** In each of these
  builds the writer's `Flush` switches to streaming, so a handler that writes, flushes and writes
  again gets `200 "part1part2"` with no ETag, and a conditional request can't get 304. The hidden
  `TestFlushDoesNotBypassTheBuffer` fails on the same builds. The judges treated "Flush streams" as
  correct (P's rationale lists it as a strength) and flagged the opposite case, "Flush is a
  buffered no-op", as minor. The key follows the request as the hidden test reads it.

### discount-codes

- **negative-zero, L (probe-only). The probe is right.** `render()` of an empty cart with SAVE10 or
  FIVEOFF prints `Discount (SAVE10) -$0.00`. Neither judge listed it for L.

### chi-mount-routes

- **mount-wildcard, H J (probe-only). The probe is right.** After `Mount("/m", sub)` plus
  `Get("/m/*")`, Walk lists only `GET /m/x` and misses `GET /m/*`, the same output as A–G and M.
  Judge 0's own summary says A–H, J and M give identical Walk/Routes output, but it listed the gap
  for every build except H and J.
- **mount-wildcard, K L (judge-only). The probe is right.** K and L report the wildcard route, and
  once `Handle("/m/*")` shadows the subrouter for every method they drop it, which is the keyed
  case. The judges flagged something else: their tests keep listing a subrouter GET that a
  GET-only `Get("/bar/*")` shadows. The base code does that too, and the key covers only a
  pattern that "fully shadows" the subrouter.

### fd-count

- **zsh-completion, J (probe-only). The probe is right.** J's `_fd` adds `count` to
  `--batch-size`'s exclusion list, `'(long-listing max-results count)--batch-size=...'`. That is
  the same edit the judges flagged in M, and `fd --count --batch-size 5 foo` exits 0. D makes the
  same edit, and the probe flags D for it. The judges also flagged D, but for a different gap: the
  `-0` exclusion is one-sided, which isn't keyed. So D counts as agreement for different reasons.
- **write-error-silent, G H (judge-only). The probe is right, by a deliberate narrowing.** The
  judges noted that G and H exit 1 silently on a **broken pipe**. Every round-2 build and plain fd
  do the same, because fd treats EPIPE as a normal end of output. A probe that flagged it would
  flag all 13 builds and the base, and would separate nothing. So the probe tests `/dev/full`
  only, where D F J L M fail silently and the rest print `[fd error]: Could not write to output`.
  Judge 0 itself called G's broken-pipe exit "not a regression".

## Notes per probe

- **chi-etag** (`TestKey_*` in probe_test.go): flush-bypass mirrors the hidden Flush test.
  head-empty-etag checks that a HEAD through ServeContent, a Content-Length-only HEAD and a bodiless
  HEAD get no ETag, or the GET's.
- **rac-shadow-hide**: three jest probes on `ariaHideOutside` with `enableShadowDOM()`, plus the
  hidden `checks.sh lockfile` check (`yarn install --mode=update-lockfile` must leave yarn.lock
  unchanged). Blind copies are rebuilt automatically.
- **ui-lib**: five vitest + Testing Library probes through the public components, driven with
  user-event. trap-hidden-content checks Tab from the last visible element and Shift+Tab from the
  first, with hidden TabPanels, `tabIndex=-1`, `display:none` (on the element or a parent) and
  `hidden` content at both ends. A focusin guard that pulls focus back counts as a pass.
  combobox-index prepends options while the list is open, then checks that Enter commits the
  highlighted option or nothing.
- **risky-auth / risky-refunds**: the hidden forced-interleaving stress tests, unchanged. Over 10 runs,
  every pool build was 0/10 or 10/10 (see `keys-round2.json` for which).
- **discount-codes**: unittest. Look-alikes `ſave10`, `FIVEOﬀ` and fullwidth `ＳＡＶＥ１０` must raise
  InvalidCode. An empty cart with either code must not render `-$0.00`.
- **chi-mount-routes**: Go test in its own package against `chi.Walk` and `Routes()`.
  empty-handler-route walks `Routes()` recursively, and only I fails it.
- **tailwind-anchor**: vitest with the repo's `run()`. Bare names `1.5`, `50%`, `a.b`, `2.5x` must
  not emit a non-ident. `anchor-1`, `-2col` and `-3d-menu` must emit `--1` and so on.
- **fd-count**: two checks added to the existing probe. `zsh_count.py` parses `_fd`, and a flag
  that the completion excludes next to `--count` is wrong when `fd --count <flag>` isn't a usage
  error. A whole group, such as exec-cmds, is wrong only if none of its members conflicts.
- The older non-key probe ids (chi-etag `HeadServeContent` and so on, and fd-count's snake_case
  ids) are still printed. `--keys` keeps only keys.json ids. fd-count's old
  `no_partial_count_on_interrupt` is timing-based, and no key depends on it.

No key was skipped.

## Stress flakiness (risky-auth, risky-refunds)

Each pool build's hidden stress test was run 10 times, each time on a fresh copy, 4 builds at a time. Every build is 0/10 or 10/10, so nothing needed fixing.

**risky-auth**

| Letter | Arm | Rep | Passes |
|---|---|---|---|
| A | lite-shipped-0.2 | 1 | 10/10 |
| B | lite-shipped-0.2 | 3 | 10/10 |
| C | lite-reviewer-plus | 5 | 10/10 |
| D | lite-shipped-0.4 | 5 | 0/10 |
| E | lite-tests-first | 2 | 0/10 |
| F | lite-shipped-0.2 | 4 | 0/10 |
| G | lite-tests-first | 1 | 0/10 |
| H | lite-reviewer-plus | 2 | 10/10 |
| I | lite-shipped-0.4 | 1 | 0/10 |
| J | lite-reviewer-plus | 1 | 10/10 |
| K | lite-tests-first | 3 | 0/10 |
| L | lite-shipped-0.4 | 4 | 0/10 |
| M | lite-0.2-criteria | 2 | 0/10 |
| N | lite-shipped-0.4 | 2 | 0/10 |
| O | lite-reviewer-plus | 3 | 10/10 |
| P | lite-0.2-criteria | 3 | 0/10 |
| Q | lite-tests-first | 4 | 0/10 |
| R | lite-shipped-0.2 | 5 | 0/10 |
| S | lite-tests-first | 5 | 0/10 |
| T | lite-shipped-0.4 | 3 | 10/10 |
| U | lite-shipped-0.2 | 2 | 0/10 |
| V | lite-0.2-criteria | 1 | 10/10 |
| W | lite-reviewer-plus | 4 | 10/10 |

**risky-refunds**

| Letter | Arm | Rep | Passes |
|---|---|---|---|
| A | lite-shipped-0.2 | 3 | 10/10 |
| B | lite-tests-first | 1 | 10/10 |
| C | lite-0.2-criteria | 1 | 10/10 |
| D | lite-reviewer-plus | 2 | 0/10 |
| E | lite-0.2-criteria | 2 | 10/10 |
| F | lite-reviewer-plus | 5 | 10/10 |
| G | lite-reviewer-plus | 1 | 10/10 |
| H | lite-shipped-0.4 | 1 | 0/10 |
| I | lite-0.2-criteria | 3 | 0/10 |
| J | lite-shipped-0.4 | 3 | 0/10 |
| K | lite-shipped-0.2 | 2 | 0/10 |
| L | lite-shipped-0.4 | 2 | 0/10 |
| M | lite-reviewer-plus | 3 | 10/10 |
| N | lite-tests-first | 4 | 10/10 |
| O | lite-shipped-0.2 | 4 | 10/10 |
| P | lite-tests-first | 2 | 10/10 |
| Q | lite-shipped-0.4 | 4 | 0/10 |
| R | lite-shipped-0.2 | 5 | 10/10 |
| S | lite-shipped-0.2 | 1 | 10/10 |
| T | lite-tests-first | 3 | 10/10 |
| U | lite-shipped-0.4 | 5 | 10/10 |
| V | lite-reviewer-plus | 4 | 0/10 |
| W | lite-tests-first | 5 | 0/10 |

