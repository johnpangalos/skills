# Handoff: a machine-wide limit on heavy commands, and a macOS port of the check cache

Branch `claude/machine-limiter`, started from `claude/review-gate-cache`. This
file is the brief for continuing on a Mac. Delete it once the work lands.

## Status

**Update (feature-flow-lite 0.3.0):** the mod's extras were removed, and with them
`ffcc-queue.sh`, `ffcc-base.sh` and the queue's paths in `ffcc.sh` (background
runs, preemption, the limited command line). They showed no gain in the evals
(`evals/README.md`, sections 15 and 16). The check cache itself and its
heavy-limiter integration for agents' own checks remain. Read the queue and
base-worktree parts below as history.

Steps 1 to 3 of "Order of work" are done on this branch. Step 4, trying it on
real workloads, is still open.

- **The port.** `ffcc-portable.sh` picks each tool at startup, and
  `ffcc.test.sh` covers the cases below. It passes 32 of 32 on macOS (bash 3.2,
  stock `PATH`); it hasn't been run on Linux since the port. The missing-tool
  guard is gone. Two macOS bugs it found are fixed: `rel` is taken from the
  real path, since `$TMPDIR` is a symlink there; and `taskpolicy` is used only
  where it works, since the sandbox refuses setpriority.
- **The limiter** is the `heavy-limiter` plugin. `hooks/heavy.pl` holds the
  pool, `hooks/heavy.ts` decides which commands are heavy, and
  `hooks/register.ts` is the mod. Tests: `claude plugin test heavy-limiter`
  and `bash heavy-limiter/hooks/heavy.test.sh`. Where it differs from the
  design below:
  - Liveness is a `flock` each participant holds on its own pool file, not a
    pid and start time. macOS's sandbox hides other commands' processes and
    refuses `ps`, so pids can't be checked from there. A lock can't be reused
    the way a pid can.
  - The pool is `/tmp/claude-heavy-<uid>`, not `~/Library/Caches`, because
    sandboxed commands can't write the latter.
  - The mod passes the budget in, because the sandbox refuses `sysctl`.
  - Peak memory is sampled with `ps` over the command's process tree.
    `/usr/bin/time -l` fails in the sandbox, and in any case it only gives the
    largest single process. Inside the sandbox nothing is sampled, so weights
    come from unsandboxed runs or the defaults.
  - `cargo run` isn't wrapped: it is often a server, which would hold its slot
    for as long as it runs.
  - Speculative work only goes behind agents' commands; it isn't preempted
    machine-wide. Whether feature-flow-lite's queued checks go through the
    limiter at all depends on hook order: they do when the limiter's rewrite
    ran first, since the queued words then include its wrapper.
  - feature-flow-lite's `checkOf` reads through the limiter's wrapper, so in
    either hook order the cache wraps the limiter and a replayed pass takes no
    slot.

## Why

Running several Claude Code sessions in parallel on one machine slows them all
down when they build or test at once. Each `cargo build`, Playwright run, jest or
type check sizes itself to the whole machine, so N agents start N times too many
jobs and run out of memory. Playwright's timeouts are wall-clock, so the slowdown
also produces false test failures that agents then "fix".

Evidence from the evals (`feature-flow-lite/evals/README.md`, sections 15 and 16;
a 4-CPU, 16 GB Linux box running react-spectrum):
- Starting background checks at full parallelism made two builds 2–3× slower
  (51–64 min against 23).
- Queuing them for one low-priority, one-thread worker that agents can preempt
  removed the slowdown (25.2 min against 27.9 for the arm without background
  checks).
- Memory, not CPU, was the hard limit: react-spectrum's type check (`tsgo`) peaks
  at about 6 GB, and three at once got one killed.

## What exists today (Linux only)

All in `feature-flow-lite/hooks/`:

| File | What it does |
|---|---|
| `check-cache.ts` | The parser. It splits a Bash command into sub-commands, recognizes checks (go, gofmt, golangci-lint, pytest/mypy/ruff/black, cargo, yarn/npm/npx/pnpm scripts, jest, eslint, tsc/tsgo, vitest) and normalizes them into a key. It never wraps commands that write. It also has `lowThreadWords` (one-worker variants of a check). Tests are in `check-cache.test.ts`. |
| `ffcc.sh` | The cache wrapper every check goes through. The key is the check, the directory, the tree fingerprint (HEAD + hashes of changed and untracked files) and the toolchain. On a hit it replays the output and exit status. Same-key runs share a lock, so the second replays the first. Only passes are cached, plus base-commit results. The ledger is `.git/ff-check-cache/ledger.tsv`. |
| `ffcc-queue.sh` | The per-repo queue for checks the mod runs ahead of time. One worker runs one job at a time at `nice 19` / `ionice -c3`, cheapest first. A newer tree's batch replaces older jobs. An agent can preempt a running job: it waits if the job should finish within 30 s, and otherwise kills the job's process group. |
| `ffcc-base.sh` | The base-commit worktree. It hard-links the main tree's ignored paths (`cp -al`), leaving out files tools rewrite in place. |
| `register.ts` | The mod. The Bash `tool.call` hook rewrites checks through `ffcc.sh` when `FEATURE_FLOW_CHECK_CACHE=1`. `FEATURE_FLOW_EXTRAS=1` adds the base checks and the checks run ahead. |

The cache lives in the repo's git common dir, so worktrees of one repo share it.
Keep it per repo (see "Design" below).

### Linux-only pieces to port

`ffcc.sh` currently runs every command uncached when `flock`, `setsid`,
`sha256sum` or GNU `stat` is missing, which is the case on macOS. So nothing is
cached there yet, but nothing is wrong either.

| Used | Where | macOS replacement |
|---|---|---|
| `flock` | `ffcc.sh` (per-key lock, `-n`, `-w`), `ffcc-queue.sh` (worker lock) | `mkdir` locks (atomic on both) with a pid file and stale-lock detection (`kill -0`), or `perl -MFcntl=:flock`. Perl ships with macOS. |
| `setsid` | `ffcc.sh` (a background check in its own process group, so preemption kills yarn → node → workers); `ffcc-queue.sh` (a detached worker) | `perl -e 'use POSIX; setsid(); exec @ARGV' -- cmd…` |
| `sha256sum` | the keys in `ffcc.sh` | `shasum -a 256` (on both). Pick one at startup. |
| `stat -L -c '%s %Y'` | the toolchain hash in `ffcc.sh` | `stat -L -f '%z %m'` on macOS. Detect with `stat --version`. |
| `date +%s%N` / `%s.%N` | timings, job names | `perl -MTime::HiRes=time -e 'printf "%.3f", time'` |
| `mapfile -d ''` | `ffcc-queue.sh` reading NUL-separated args | macOS's `/bin/bash` is 3.2: use a `while IFS= read -r -d '' w` loop, or require a newer bash in the shebang |
| `ionice -c3` | `ffcc-queue.sh` | `taskpolicy -b` (background QoS: CPU and IO throttled) on macOS, with `nice -n 19` on both |
| `cp -al` | `ffcc-base.sh` | `cp -cR` (APFS clone: copy-on-write, no disk cost, separate paths) on macOS. Note that `cp -c` clones files, but check how it treats symlinks; workspace links must stay relative links. |
| `timeout` | `ffcc-queue.sh` | not on stock macOS (`gtimeout` with coreutils). Use a perl `alarm` wrapper or a background `sleep; kill` watchdog |
| `realpath -m`, `find -printf` | none in the scripts | – |

## Design for the machine-wide limiter

A standalone mod (its own plugin), usable with or without feature-flow-lite.

1. **A slot pool per machine**, for example `~/Library/Caches/claude-heavy/` on
   macOS (`$XDG_CACHE_HOME/claude-heavy` on Linux). Every session, terminal and
   worktree shares it.
2. **Budgets in cores and memory, not job counts.** Each heavy command has a
   weight: cores it will use and peak memory. A command starts when the free
   budget covers it. Defaults come from `sysctl hw.ncpu hw.memsize` (macOS) or
   `nproc` and `/proc/meminfo` (Linux), minus headroom for the sessions
   themselves.
3. **Weights from a machine-wide record** of each command's duration and peak
   memory (per repo + key), measured by the wrapper. Use `/usr/bin/time -l` on
   macOS (max RSS in bytes); on Linux, poll the process group's RSS or use
   `/usr/bin/time -v` when it's installed. Unknown commands start with defaults
   per kind: `cargo build/test`, `playwright test`, jest/vitest, tsc/tsgo,
   `go test`.
4. **Which commands it wraps.** Reuse `check-cache.ts`'s tokenizer and add the
   heavy non-check commands: `cargo build/run/test/clippy`, `npx playwright
   test`, `next build`, `vite build`, `docker build`. Never wrap servers or watch
   modes (`dev`, `serve`, `--watch`, Playwright's `webServer` started from its
   config is fine since `playwright test` holds the slot).
5. **Fewer workers per command when contended**, as hints only (on its own, a
   single command gets the whole machine):
   - cargo: `CARGO_BUILD_JOBS`;
   - Playwright: `--workers`;
   - jest/vitest: `--maxWorkers`;
   - go: `-p`.
6. **Priority.** A command an agent is waiting on (foreground Bash) goes ahead of
   speculative work (feature-flow-lite's queue). Speculative work runs with
   `nice` / `taskpolicy -b` and can be preempted, as in `ffcc-queue.sh`.
7. **Agents must know they are waiting.** A command waiting for a slot still
   counts against the Bash tool's 2-minute default timeout. The wrapper prints
   `waiting for a slot: 2 ahead (cargo test in ~/src/foo, ~3 min)` on stderr.
   The mod's `tool.call` hook can add a note suggesting
   `run_in_background` when the expected wait is long.
8. **Nesting.** A command that holds a slot sets `CLAUDE_HEAVY_SLOT=1`, and
   commands nested under it don't take another one (a script running
   `cargo test` from inside a held `make check`).
9. **Crash safety.** A slot records its holder's pid and process start time.
   Slots whose holder is gone are reclaimed.
10. **Rust tip to document with it:** `sccache` with one shared
    `SCCACHE_DIR` lets parallel worktrees stop recompiling the same
    dependencies. A shared `CARGO_TARGET_DIR` serializes builds on cargo's
    lock instead.

The results cache stays per repo. A machine-level one would only add sharing
between separate clones of a repo, which rarely hit (the toolchain part of the
key differs per install). It would also need its own expiry and size limits.

## Order of work

1. **Port `ffcc.sh`, `ffcc-queue.sh` and `ffcc-base.sh` to portable shell.**
   Choose the platform's tool once at the top of each script. Add
   `hooks/ffcc.test.sh`, a plain bash test that makes a temp git repo and
   checks:
   - a miss then a hit, and that only passes are stored;
   - a changed file misses;
   - concurrent same-key runs: the second replays the first;
   - queue order (short before long, base last);
   - `--replace` drops older jobs;
   - a cached job is skipped;
   - preemption kills the whole process group and records `preempted`;
   - a near-done run is waited for.

   The Linux versions of these tests were run by hand in this session (see the
   commit `cbdf066`); turn them into the script.
2. **Remove the missing-tool guard** at the top of `ffcc.sh`, or keep it only
   for tools still missing after the port.
3. **The limiter mod.** Slot pool, weights, the record, the wrapper and the
   waiting note, with tests (`claude plugin test`) and a bash test of the pool:
   two processes, a budget of one, the second waits, a dead holder is reclaimed.
4. **Try it for real.** Run three sessions on a Rust repo and a Playwright
   suite, with and without the limiter, and compare wall time, peak memory and
   flaky failures.

## Running the existing tests

- `claude plugin test` from `feature-flow-lite/`. Two eval fixture files under
  `evals/harness/hidden/` fail to load; that's expected, because they import
  vitest.
- Type check: `tsc` with `strict` and `noUncheckedIndexedAccess`, with the
  `claude-code` module mapped to the engine's `claude-code.d.ts` (path printed
  by the plugin-authoring skill).
