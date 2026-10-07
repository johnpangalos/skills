---
name: feature-flow
description: Use when implementing a feature or non-trivial fix through a multi-subagent pipeline (investigate, implement, verify, review, fix) under a tight AI spend budget. The main Opus conversation orchestrates; cheaper Sonnet and Haiku subagents do the work.
---

# Feature Flow

## Purpose

A fixed, predictable orchestration for single features and non-trivial fixes. It works like a
hand-written "dynamic workflow": the main conversation (Opus 5.5, medium effort) plans and
orchestrates, and subagents (mostly Sonnet 5.5, some Haiku 5.5) do the work. The aim is
consistent results at the lowest spend that still gives a trustworthy review.

## When to use / not use

Use for:
- A feature or fix that touches more than one file, or needs investigation, tests, or review.
- Work where a cheap pipeline with a capped review loop is preferable to ad-hoc prompting.

Do not use for:
- One-line or one-file tweaks with an obvious fix: do them directly in the main conversation
  (optionally followed by the verifier).
- Pure questions or explanations: answer directly, or use one explorer.
- Codebase-wide bug hunts, security audits, or large migrations (thousands of files): see
  "Escalating to a dynamic workflow" below.

## Roster

Use model aliases (`opus`, `sonnet`, `haiku`), never full model IDs. Set the model with `model:`
in agent frontmatter or the `model` parameter on the Agent call (the per-call value overrides
frontmatter). This brief does not confirm a mechanism for pinning effort per subagent; check
what your Claude Code version supports, and if effort cannot be set, treat the effort column as
the target and keep the prompt scoped accordingly.

Only agents with `Agent` in `tools` can spawn subagents. Nesting depth is limited (default 3,
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`); main -> implementor -> verifier is depth 2.

### Core roles

| Role | Model | Effort | Tools | When to spawn |
|---|---|---|---|---|
| Investigator | sonnet (haiku if it only locates files) | low | Read-only (Read, Grep, Glob) | Before implementing, unless triage skipped it. Returns paths, findings, short summary. |
| Implementor | sonnet | medium (high on retry or a known-tricky task, never by default) | Read, Edit, Write, Bash, `Agent` | Every run. May spawn the verifier itself. |
| Simplifier | haiku (or sonnet / low) | medium (low if sonnet) | Read, Edit | Only when the diff is non-trivial. Bounded, behavior-preserving cleanup. |
| Reviewer | sonnet; opus only for risky diffs | high (medium if opus) | Read-only, Bash for running checks | After mechanical checks pass. Opus for auth, payments, migrations, concurrency. |

### Supporting roles

| Role | Model | Effort | Tools | When to spawn |
|---|---|---|---|---|
| Explorer / mapper | haiku | low | Read-only | Cheap codebase search; returns paths and short summaries. |
| Verifier / browser checker | haiku | low | Bash, Read (no `Agent`) | Runs tests, linters, Chrome DevTools CLI checks. Reports pass/fail only. |
| Test writer | sonnet | low | Read, Edit, Write, Bash | Only when tests are needed. Kept separate so tests are not shaped by the implementation. |
| Debugger | sonnet | medium | Read, Bash, Edit | Only when the fix loop stalls. |
| Docs writer | haiku | low | Read, Edit, Write | Once, at the end, from the final diff. |
| Summarizer / compactor | haiku | low | Read | Only on long flows, to pass a compact summary between phases. |
| Security reviewer | sonnet | medium | Read-only | Only for sensitive diffs (auth, secrets, input handling, payments). |
| Migration agent | sonnet | low | Read, Edit, Bash | Rule-based mechanical changes with an explicit rule set. |

### Deliberately not in the roster

- Separate planner and orchestrator: the main Opus conversation does both.
- Separate critic / red-teamer: folded into the reviewer prompt ("argue against this diff").

## The flow

### 1. Triage (main conversation, no subagent)

Decide size and risk, then pick stages:

| Change | Stages |
|---|---|
| One-file tweak | implementor (or main directly) -> verifier. Skip investigator and simplifier. |
| Typical feature / fix | investigator -> implementor (+ verifier) -> checks -> reviewer -> fix loop |
| Needs new tests | add test writer, briefed from the spec, not the implementation |
| Risky area (auth, payments, migrations, concurrency) | reviewer on opus / medium; add security reviewer if sensitive |
| Codebase-wide or thousands of files | do not use this flow; see escalation section |

State the chosen stages to the user in one line before starting.

### 2. Typical run

1. **Investigator** (or explorer if only locating files): returns relevant paths, current
   behavior, constraints, and risks.
2. **Test writer** (if needed): writes tests from the acceptance criteria. Can run in parallel
   with the implementor since it works from the spec.
3. **Implementor**: makes the change, then spawns the **verifier** (haiku) to run the relevant
   tests and linters. Returns diff summary plus verifier result.
4. **Simplifier** (only if the diff is non-trivial): cleanup without behavior change; re-run the
   verifier afterwards.
5. **Mechanical checks before review**: lint, type check, tests must pass before the reviewer
   runs. Never pay a reviewer to find what a linter finds.
6. **Reviewer**: reviews the diff against the acceptance criteria, including a short
   adversarial pass. Returns findings ranked by severity.
7. **Fix loop** (see below), then **docs writer** once if docs are affected.
8. Main conversation reports the outcome to the user.

## Loop and escalation rules

- **Fix loop cap: 2 rounds.** A round is implementor fix -> verifier -> reviewer.
- **Round 2 review is incremental**: send the reviewer only the changed hunks plus its own
  round-1 findings, not the whole diff again.
- **On failure, escalate effort before model**: retry the implementor at high effort first.
  Only after that may any role be escalated to opus.
- **Stalled loop** (same failure twice, or no progress): spawn the debugger once instead of
  another blind implementor retry.
- **After the cap, stop.** Report to the user: what passed, what still fails, reviewer's open
  findings, and a recommended next step. Do not start round 3 without the user's approval.
- Only blocking findings (correctness, security, failing acceptance criteria) trigger a fix
  round. Style nits are reported, not looped on.

## Handoff conventions

Subagents do not inherit the parent conversation. Every handoff prompt must be self-contained.

### Handoff prompt template

```
ROLE: <role> (<model>/<effort>)
GOAL: <one or two sentences: what done looks like>
FILES: <exact paths to read or change; note which the explorer already summarized>
CONTEXT: <prior findings, verbatim and compact; do not re-read what is summarized here>
CONSTRAINTS: <scope limits, files not to touch, style rules, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <testable criterion>
- <testable criterion>
CHECKS: <exact commands to run, e.g. test and lint commands>
RETURN: the structured result format below, nothing else. Keep it under ~30 lines.
```

### Subagent result template

```
STATUS: pass | fail | blocked
SUMMARY: <2-3 sentences>
FILES TOUCHED: <paths, or "none">
FINDINGS: <bulleted, severity-tagged for reviewers: [blocking] / [minor]>
CHECKS: <command -> pass/fail, one line each>
OPEN QUESTIONS: <anything the parent must decide, or "none">
```

The parent pays for every token returned. No full file dumps, no full logs (quote only the
failing lines), no restating the prompt.

## Budget guardrails

- **Fewest agents that do the job.** Triage decides; skip optional roles by default.
- **No duplicate reading.** If the explorer or investigator summarized files, pass that summary
  on; later agents read only the files they must change or verify.
- **Cheap before expensive.** Haiku verifier and linters before any Sonnet/Opus review.
- **Opus is the exception.** Main conversation only, plus the reviewer on risky diffs, plus
  escalation after a failed high-effort retry.
- **Report heavy steps.** Tell the user before a token-heavy step (Opus reviewer, debugger,
  large investigation, parallel fan-out) and after the run, list which agents ran.
- **Use the compactor only on long flows**, when passing raw results between phases would
  cost more than one Haiku summarization.
- **Respect the cap.** Stopping and reporting after round 2 is the expected outcome, not a
  failure of the flow.

## Escalating to a dynamic workflow

This pipeline is built for a single feature. For codebase-wide bug hunts, security audits, or
large migrations (thousands of files), recommend the user hand the task to a Claude Code
dynamic workflow instead, where Claude plans its own orchestration across many parallel
subagents. When recommending it, tell the user:

- Dynamic workflows can use substantially more tokens than this flow.
- Start with a scoped task (one directory, one bug class, one migration rule) before a full run.
- It is unconfirmed whether model and effort can be pinned per workflow subagent, so spend is
  harder to control than here.
- Use this flow's reviewer (sonnet / high, or opus / medium if risky) as the final check on the
  workflow's output before merging.
