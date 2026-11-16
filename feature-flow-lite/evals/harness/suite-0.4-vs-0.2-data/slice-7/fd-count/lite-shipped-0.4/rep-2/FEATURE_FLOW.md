# Feature Flow: fd

## Kind

CLI; Rust, clap derive (src/cli.rs).

## Checks

- Full: `cargo test`; `cargo clippy --all-targets --all-features -- -D warnings`; `cargo fmt --check`
- Targeted: `cargo test --test tests <name>`
- Run it: `cargo run -q -- <args>` (or `target/debug/fd`)

## Conventions

- New flag: src/cli.rs (clap, conflicts_with), src/config.rs, behavior in src/walk.rs / src/output.rs, man page doc/fd.1, zsh completion contrib/completion/_fd, CHANGELOG.md under "# Upcoming Release" → "## Features", tests in tests/tests.rs using TestEnv.

## Standing criteria

- Every error exits non-zero with a message on stderr; usage errors come from clap (exit 2).
- Output that fails to write (broken pipe) doesn't panic.

## Reviewer checklist

- Flag conflicts tested both orders; help text and man page match the code; completions updated.
- Ctrl-C and broken pipe behave like the sibling flags.
- A broken pipe exits 1 (`flush()` → `GeneralError`); a new output mode must match that. zsh `_fd` exclusions go both ways.
