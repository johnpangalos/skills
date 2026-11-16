# Feature Flow project file

Kind: Python library (Click).

## Checks
- `.venv/bin/pytest -q`
- `.venv/bin/mypy`
- `.venv/bin/ruff check`
- `.venv/bin/ruff format --check`

## Conventions
- Tests live under `tests/`.
- User-facing changes get an entry under the topmost unreleased version in `CHANGES.md`, with `{pr}`/`{issue}` role style.
- Deprecation tests go in `tests/test_deprecations.py`.
- Deprecations: documented in `docs/upgrade-guides.md`; warn with `DeprecationWarning` naming the removal version (Click 9.0) and the replacement.
- Parameter API changes are documented in `docs/parameters.md`.

## Standing criteria
- No new dependencies; public API typed for mypy strict.

## Reviewer checklist
- Every new behavior has a test; changelog, docs and help text match the code.
- No unrelated edits; existing tests changed only where the request changes behavior.
