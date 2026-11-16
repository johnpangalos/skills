# Feature Flow project file

## Kind
Python library (Click, CLI framework). Source in `src/click/`, tests in `tests/`.

## Checks
- `.venv/bin/pytest -q`
- `.venv/bin/mypy`
- `.venv/bin/pyright --ignoreexternal --verifytypes click` (CI `typing` env)
- `.venv/bin/ruff check`
- `.venv/bin/ruff format --check`

## Run it
`.venv/bin/python -c "import click; ..."` or `click.testing.CliRunner` in a probe script.

## Conventions
- Every user-visible change gets an entry under the topmost *Unreleased* version in `CHANGES.md`, with `{pr}`/`{issue}` role.
- Deprecations: a bullet in `docs/upgrade-guides.md` under "Deprecations", naming the replacement; tests in `tests/test_deprecations.py`.
- Deprecation warnings use `DeprecationWarning` with `stacklevel=_outside_click_stacklevel()` (see `core.py`) and say "will be removed in Click 9.0".
- New public API gets `.. versionadded::` in its docstring; changed API gets `.. versionchanged::`.
- Parameter behavior tests live in `tests/test_options.py` / `tests/test_arguments.py`.

## Standing criteria
- No new dependencies. Full test suite, mypy, pyright verifytypes, ruff check/format pass.
- Click's own code does not emit any of its own `DeprecationWarning`s during the test suite.

## Reviewer checklist
- Docstrings and docs sentences match the code's actual behavior.
- Changelog entry is under the unreleased version, not a released one.
- No edits to unrelated lines.
