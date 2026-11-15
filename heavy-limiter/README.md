# heavy-limiter

A mod that makes parallel Claude Code sessions on one machine take turns with
heavy commands. `cargo build`, `go test`, Playwright, jest, vitest, tsc and
production builds each size themselves to the whole machine, so N sessions
start N times too many jobs, run out of memory, and turn wall-clock test
timeouts into false failures.

## How it works

Every session shares one pool per user, `/tmp/claude-heavy-<uid>`. The mod
rewrites each heavy command in a Bash call to go through `hooks/heavy.pl`,
which starts it once the pool has room:

- **Budget.** The machine's cores less one, and its memory less a fifth (at
  least 4 GB), for the sessions themselves.
- **Weights.** Each command has cores and peak memory. The defaults depend on
  the kind of command. After a run passes, its duration and peak memory are
  recorded per repo and command, and the next run is weighed by that record.
  The peak is the sum over all the command's processes, sampled with `ps`. In
  macOS's sandbox, `ps` can't run, so those runs keep the default.
- **Order.** An agent's command goes ahead of speculative work
  (feature-flow-lite's queued checks, or `CLAUDE_HEAVY_LOW=1`), then first
  come, first served. A command that doesn't fit holds the ones behind it, so
  a big one is never starved. A command alone always starts.
- **Fewer workers when contended.** A command that gets fewer cores than the
  machine has is told how many: `CARGO_BUILD_JOBS`, Playwright's `--workers`,
  jest and vitest's `--maxWorkers`, and `go test -p`. Settings already on the
  command are kept. Package scripts (`yarn test`, `npm run build`) take no
  hint, so they wait for the whole machine.
- **Waiting.** A waiting command prints
  `heavy-limiter: waiting for a slot: 2 ahead (cargo test in ~/src/foo, ~3 min left)`
  on stderr. When the pool expects a wait, the mod adds it to the call's
  timeout, up to 10 minutes. A call that waited says so in its result.
- **Crash safety.** Each participant holds a lock on its own file in the
  pool, so the slot of a killed or crashed process is reclaimed at once. This
  holds even where a sandbox hides other processes.
- **Nesting.** A command holding a slot sets `CLAUDE_HEAVY_SLOT=1`. Commands
  under it (a script running `cargo test`) don't take another.

It never wraps servers, watch modes or interactive runs: `cargo run`,
`vitest` without `run`, `--watch`, Playwright's `--ui`, `next dev`. With
feature-flow-lite's check cache on, the limiter goes inside the cache's
wrapper, so a replayed pass takes no slot. feature-flow-lite's queued background checks reuse
the limited command line of the agent's last run of the same check, so they also
wait in the pool, as low-priority work, whichever mod rewrote the call first.

## Settings

| Variable | Effect |
|---|---|
| `CLAUDE_HEAVY=0` | Off, for the session; on one command, `CLAUDE_HEAVY=0 cargo test` |
| `CLAUDE_HEAVY_DIR` | Another pool folder (every session that should share must agree) |
| `CLAUDE_HEAVY_CORES`, `CLAUDE_HEAVY_MEM_MB` | The budget outright |

## Rust

`sccache` with one shared `SCCACHE_DIR` lets parallel worktrees stop
recompiling the same dependencies. A shared `CARGO_TARGET_DIR` doesn't do
that. It serializes builds on cargo's lock instead.

## Tests

```sh
claude plugin test heavy-limiter
bash heavy-limiter/hooks/heavy.test.sh
```
