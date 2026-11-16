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

## Results: three react-spectrum sessions at once (Linux, 4 cores, 16 GB)

`bench/contention.sh` runs three sessions at once, each in its own react-spectrum
workspace. Each session runs `yarn check-types` (about 20 s and 7 GB alone), a jest run
over four packages, and `yarn check-types` again. All nine steps pass when run alone.

| | Without the limiter | Limiter, empty pool | Limiter, weights measured |
|---|---|---|---|
| Time until all three finish | 230.5 s | 146.6 s | **129.7 s** |
| Peak memory used | 15.5 GB of 16 | 7.9 GB | 8.2 GB |
| Steps that failed | **3 of 9**: type checks killed for lack of memory (SIGKILL), not type errors | 0 | 0 |
| One type check | 144–168 s | 19–23 s (when it runs) | 19–23 s |

- **Without the limiter the machine runs out of memory.** Every type check slows by 7–8×,
  and half of them are killed. An agent would see a type check fail on correct code and go
  looking for an error that isn't there.
- **With the limiter the type checks take turns.** Each runs at full speed, so all three
  sessions finish sooner even though they wait.
- **Measured weights help a little more (130 s against 147 s).** The pool learns the type
  check's real peak (6.8–7.1 GB) and jest's (about 1 GB), so it can run a jest beside a type
  check.
- **On an empty pool the defaults guessed wrong but did no harm.** `check-types` defaults to
  3 GB, but as a package script it also takes every core, so it never ran beside another type
  check. A heavy command whose default memory is too low and which takes only one core could
  still overcommit on its first run, before its real peak is recorded.
- **Running this found a deadlock.** Two commands that joined the pool at the same instant
  each sorted the other first, and both waited forever. Waiters are now ordered the same way
  in every process: arrival as stored, then the participant's unique id. A test forces the tie.

## Tests

```sh
claude plugin test heavy-limiter
bash heavy-limiter/hooks/heavy.test.sh
```
