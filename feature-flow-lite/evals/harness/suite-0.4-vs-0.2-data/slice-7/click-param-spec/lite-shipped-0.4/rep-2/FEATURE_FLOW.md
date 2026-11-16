# Feature flow: Click

Kind: Python library (CLI framework).

## Checks
- `.venv/bin/pytest -q`
- `.venv/bin/mypy`
- `.venv/bin/ruff check`
- `.venv/bin/ruff format --check`

## Conventions
- Tests under `tests/`.
- Changelog entry under the topmost Unreleased version in `CHANGES.md`, with `{pr}`/`{issue}` refs.
- API changes and deprecations: `docs/upgrade-guides.md`; parameter behavior: `docs/parameters.md`.
- Deprecations emit `DeprecationWarning` naming the replacement and the removal version (9.0).

## Reviewer checklist
- Click itself must not trigger its own deprecation warnings (tests run with warnings as errors where configured).
- Public API changes have docstrings with `versionadded`/`deprecated` markers.
