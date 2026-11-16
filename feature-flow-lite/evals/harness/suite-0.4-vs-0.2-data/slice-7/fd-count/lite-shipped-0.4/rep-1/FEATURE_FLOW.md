# Feature Flow: fd

## Kind

CLI (Rust, clap derive), existing codebase.

## Checks

- Full: `cargo test`; `cargo clippy --all-targets --all-features -- -D warnings`; `cargo fmt --check`
- Targeted: `cargo test --test tests <name_substring>`
- Run it: `cargo run -- <args>` (or `target/debug/fd <args>`) in a temp dir

## Conventions

- New flag: `src/cli.rs` (doc comment = long help, `hide_short_help` for rarer options, conflicts via `conflicts_with`/ArgGroup), wiring in `src/config.rs` + `src/main.rs`, behaviour in `src/walk.rs`/`src/output.rs`; man page `doc/fd.1`; CHANGELOG.md under `# Upcoming Release` → `## Features`; tests in `tests/tests.rs` using `TestEnv`. Zsh completion `contrib/completion/_fd` is hand-written and must list the new flag and its exclusion groups.

## Standing criteria

- Every error exits non-zero with a message on stderr; output that fails to write (closed pipe) does not panic.
- Help text and man page describe the same behaviour as the code.

## Reviewer checklist

- Run the new flag against a temp tree, including combinations with conflicting flags (clap usage error, exit 2).
- Man page entry, CHANGELOG entry and tests for every new behaviour present.
- No unrelated edits.
- New output modes: a closed stdout pipe must give the same exit code as plain fd (exit 1, e.g. `fd -1 x | head -0`).
