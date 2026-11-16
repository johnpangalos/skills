# Feature Flow project file

Kind: Rust CLI (fd).

## Checks
- cargo test
- cargo clippy --all-targets --all-features -- -D warnings
- cargo fmt --check

## Conventions
- New option: clap arg in src/cli.rs (with help/long_help), wired into src/config.rs, integration tests in tests/tests.rs, documented in doc/fd.1, zsh completion in contrib/completion/_fd, CHANGELOG entry under "# Upcoming Release / ## Features".

## Reviewer checklist
- Conflicting options are clap usage errors (exit 2), not runtime errors.
- Help text, man page and CHANGELOG agree with behaviour.
