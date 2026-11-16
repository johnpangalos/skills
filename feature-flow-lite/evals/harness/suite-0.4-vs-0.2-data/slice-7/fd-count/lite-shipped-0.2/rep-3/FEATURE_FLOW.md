# Feature Flow: fd

## Kind

CLI (existing codebase), Rust, clap derive (`src/cli.rs`).

## Checks

- Full: `cargo test --locked`; `cargo clippy --all-targets --all-features -- -D warnings`; `cargo fmt -- --check`
- Targeted: `cargo test --test tests <name_substring>`
- Run it: `cargo build && ./target/debug/fd <args>` (probe in a temp dir of files)

## Conventions

- New flag: `src/cli.rs` (clap attr + conflicts), `src/config.rs` + `src/main.rs` (construct_config) if the walker needs it, `doc/fd.1` entry next to related options, hand-written zsh completion `contrib/completion/_fd` (exclusion groups mirror clap conflicts), `CHANGELOG.md` under "# Upcoming Release" / "## Features", integration tests in `tests/tests.rs` using `TestEnv`.

## Standing criteria

- The existing test suite still passes; a new public feature follows the Conventions above.
- Every error exits non-zero with a message on stderr.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs, changelog, zsh completion); anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Exit codes and stderr for every error; behaviour on Ctrl-C and broken pipe matches the sibling.
- Conflicting flags are rejected by clap (usage error, exit 2), in both argument orders.
- Output printed once at the end (totals, summaries) must not appear when Ctrl-C stops the walk early: with `--color always` the ctrlc handler is installed and the receiver's `stop()` still runs.
