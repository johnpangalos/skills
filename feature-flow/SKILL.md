---
name: feature-flow
description: Use when implementing a feature, building a small project, or tracking down and fixing a bug across files, through a capped subagent pipeline (investigate, implement, verify, review, fix) under a tight AI spend budget. The main Opus conversation orchestrates or builds directly; cheaper Sonnet and Haiku subagents implement, verify and review.
---

# Feature Flow

## Purpose

A fixed, predictable orchestration for single features and non-trivial fixes. It works like a
hand-written "dynamic workflow": the main conversation (Opus 5.5, medium effort) plans and
orchestrates, and subagents (mostly Sonnet 5.5, some Haiku 5.5) do the work. The aim is
consistent results at the lowest spend that still gives a trustworthy review.

Orchestration has a fixed cost: the main conversation spends roughly $0.30-0.50 planning,
writing handoffs and reading results, about what it costs Opus to build a small project
outright. So small work takes the direct path (Opus builds, a subagent reviews), and the full
pipeline is for work big enough that delegating the bulk of it to Sonnet pays for that overhead.

## When to use / not use

Use for:
- A feature or fix that touches more than one file, or needs investigation, tests, or review.
- A small new project built to a spec.
- Tracking down a bug whose cause isn't obvious, then fixing it with a regression test.

Do not use for:
- One-line or one-file tweaks with an obvious fix: do them directly in the main conversation
  (optionally followed by the verifier).
- Pure questions or explanations: answer directly, or use one explorer.
- Codebase-wide bug hunts, security audits, or large migrations (thousands of files): see
  "Escalating to a dynamic workflow" below.

## Roster

Each role is a named agent in this skill's `agents/` folder, with its model, effort and tools
pinned in frontmatter. Spawn a role by its agent type, `feature-flow:<agent>` (for example
`feature-flow:implementor`), and leave `model` and `effort` off the Agent call so the pins hold.
Pass them on the call only to escalate (see "Loop and escalation rules"); a per-call value wins
over frontmatter.

The agents load when the skill folder loads as a plugin: installed under `~/.claude/skills/`
(its `.claude-plugin/plugin.json` makes it a skills-directory plugin) or passed with
`--plugin-dir`. A copy under a project's `.claude/skills/` loads them only after the workspace
trust prompt. If no `feature-flow:*` agent types are listed, fall back to `general-purpose`:
pass the role's model alias (`opus`, `sonnet`, `haiku`, never a full model ID) and its effort if
the Agent tool takes one, start the prompt with `ROLE: <role>`, state the role's tool limits,
and end it with the result template.

No agent has the `Agent` tool, so roles never spawn subagents; the main conversation spawns
every role. The flow then works when nesting is off (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`,
as in some cloud sessions), and every result comes back through one place.

### Core roles

| Role (agent) | Model | Effort | Tools | When to spawn |
|---|---|---|---|---|
| Investigator (`investigator`) | sonnet (`explorer` on haiku if it only locates files) | low | Read, Grep, Glob | Only on an existing codebase too large to read the relevant parts directly. Skip it on a new project or a small repo. |
| Implementor (`implementor`) | sonnet | medium (high on retry or a known-tricky task, never by default) | Read, Edit, Write, Bash, Grep, Glob | Pipeline path. Returns a diff summary; the main conversation then spawns the verifier. |
| Simplifier (`simplifier`) | haiku (or sonnet / low, passed on the call) | medium | Read, Edit, Grep, Glob | Only when the diff is non-trivial. Bounded, behavior-preserving cleanup. |
| Reviewer (`reviewer`; `risky-reviewer` for risky diffs) | sonnet; `risky-reviewer` is opus | high (`risky-reviewer`: medium) | Read, Grep, Glob, Bash for running checks | Every run, after mechanical checks pass. Works through its checklist and reproduces edge cases. `risky-reviewer` for auth, payments, migrations, concurrency. |

### Supporting roles

| Role (agent) | Model | Effort | Tools | When to spawn |
|---|---|---|---|---|
| Explorer / mapper (`explorer`) | haiku | low | Read, Grep, Glob | Cheap codebase search; returns paths and short summaries. |
| Verifier / browser checker (`verifier`) | haiku | low | Bash, Read | Runs tests, linters, Chrome DevTools CLI checks. Reports pass/fail only. |
| Test writer (`test-writer`) | sonnet | low | Read, Edit, Write, Bash, Grep, Glob | Only when tests are needed. Kept separate so tests are not shaped by the implementation. |
| Debugger (`debugger`) | sonnet | medium | Read, Bash, Edit, Grep, Glob | Only when the fix loop stalls. |
| Docs writer (`docs-writer`) | haiku | low | Read, Edit, Write, Grep, Glob | Once, at the end, from the final diff. |
| Summarizer / compactor (`summarizer`) | haiku | low | Read | Only on long flows, to pass a compact summary between phases. |
| Security reviewer (`security-reviewer`) | sonnet | medium | Read, Grep, Glob, Bash for reading diffs | Only for sensitive diffs (auth, secrets, input handling, payments). |
| Migration agent (`migration`) | sonnet | low | Read, Edit, Bash, Grep, Glob | Rule-based mechanical changes with an explicit rule set. |

### Deliberately not in the roster

- Separate planner and orchestrator: the main Opus conversation does both.
- Separate critic / red-teamer: folded into the reviewer prompt ("argue against this diff").

## The flow

### 1. Triage (main conversation, no subagent)

Decide size and risk, then pick a path:

| Change | Path |
|---|---|
| One-file tweak | main directly -> verifier. |
| Small: a new small project, or a change you could write yourself in one sitting (roughly under 600 changed lines) | **Direct path**: main builds it, runs the checks, then spawns the reviewer. Fix what it finds yourself. |
| Large: a feature in an existing codebase, or more than you'd write in one sitting | **Pipeline**: (investigator) -> implementor -> verifier -> reviewer -> fix loop |
| Needs new tests (pipeline) | add test writer, briefed from the acceptance criteria, not the implementation |
| Risky area (auth, payments, migrations, concurrency) | `risky-reviewer` (opus / medium) instead of `reviewer`; add `security-reviewer` if sensitive |
| Codebase-wide or thousands of files | do not use this flow; see escalation section |

Every path ends with a reviewer. Plain Opus builds without one, and the review is what this
flow adds.

### 2. Write the acceptance criteria once

Before building or spawning anything, write the acceptance criteria: a short list of testable
statements of what done looks like. Include the requirements the request only implies, and
spell out how they combine. "A catalog you can filter" plus "works without JavaScript" means
"the filter works with JavaScript off", not two separate checks. "Dated today" means the
user's local day. "Safe under concurrent requests" means concurrent writes lose nothing. For a
new project, a short README with run instructions is a criterion unless the user says
otherwise.

Every handoff carries this list word for word under `ACCEPTANCE CRITERIA:`, and the reviewer
checks against it. Numbers in a spec ("at least 8 titles") are floors: build what a careful
senior developer would ship, not the minimum that passes.

### 3. Direct path

1. Main builds the change and runs the project's checks.
2. **Reviewer** (or `risky-reviewer`): reviews against the acceptance criteria and its
   checklist, reproducing edge cases. Returns findings ranked by severity.
3. Main fixes the blocking findings itself, re-runs the checks, and sends the reviewer the
   changed hunks for one incremental re-review if a finding was blocking. Same cap as below.

### 4. Pipeline path

1. **Investigator** (only on a large existing codebase): returns relevant paths, current
   behavior, constraints, and risks.
2. **Test writer** (if needed): writes tests from the acceptance criteria. Can run in parallel
   with the implementor since it works from the spec.
3. **Implementor**: makes the change and returns a diff summary. The main conversation then
   spawns the **verifier** (haiku) to run the relevant tests and linters.
4. **Simplifier** (only if the diff is non-trivial): cleanup without behavior change; re-run the
   verifier afterwards.
5. **Mechanical checks before review**: lint, type check, tests must pass before the reviewer
   runs. Never pay a reviewer to find what a linter finds.
6. **Reviewer**: reviews the diff against the acceptance criteria and its checklist, including
   a short adversarial pass. Returns findings ranked by severity.
7. **Fix loop** (see below), then **docs writer** once if docs are affected.
8. Main conversation reports the outcome to the user.

## Loop and escalation rules

- **Fix loop cap: 2 rounds.** A round is implementor fix -> verifier -> reviewer.
- **Round 2 review is incremental**: send the reviewer only the changed hunks plus its own
  round-1 findings, not the whole diff again.
- **On failure, escalate effort before model**: retry the implementor at high effort first
  (`effort: high` on the Agent call). Only after that may any role be escalated to opus
  (`model: opus` on the call).
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
GOAL: <one or two sentences: what done looks like>
FILES: <exact paths to read or change; note which the explorer already summarized>
CONTEXT: <prior findings, verbatim and compact; do not re-read what is summarized here>
CONSTRAINTS: <scope limits, files not to touch, style rules, no new dependencies, etc.>
ACCEPTANCE CRITERIA:
- <the list from triage, word for word>
CHECKS: <exact commands to run, e.g. test and lint commands>
```

The `ACCEPTANCE CRITERIA:` block is required in every handoff to an implementor, test writer
or reviewer; don't rename it or fold it into another section. The named agents already know
their role and return the result template below, so a handoff restates neither: every line of
it is Opus output.

### Subagent result template

Every agent's instructions end with this format:

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
- A workflow can name a model per agent, but per-agent effort isn't documented, so spend is
  harder to control than here.
- Use this flow's `reviewer` (or `risky-reviewer` if risky) as the final check on the
  workflow's output before merging.
