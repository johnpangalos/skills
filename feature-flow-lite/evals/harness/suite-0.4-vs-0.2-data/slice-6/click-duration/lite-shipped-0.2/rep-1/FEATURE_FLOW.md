# Feature Flow: Click

## Kind

Library: Python CLI framework (`src/click`), pytest tests, Sphinx/MyST docs.

## Checks

- Full: `.venv/bin/pytest`, `.venv/bin/ruff check`, `.venv/bin/ruff format --check`, `.venv/bin/mypy`, `.venv/bin/pyright --ignoreexternal --verifytypes click` (tox `typing` env)
- Targeted: `.venv/bin/pytest tests/test_types/test_<Type>.py`
- Run it: `.venv/bin/python -c "import click; ..."` with `click.testing.CliRunner`, or a script under the scratchpad run with `.venv/bin/python`

## Conventions

- New parameter type: class in `src/click/types.py`, export in `src/click/__init__.py`, tests in `tests/test_types/test_<Name>.py`, an entry in `tests/test_info_dict.py`, `.. autoclass::` in `docs/api.md` (Types section) and in the "Built-in Types Listing" of `docs/parameter-types.md`, changelog bullet under the unreleased version in `CHANGES.md`, `.. versionadded::` in the docstring.
- Range types show their range in option help via `Option.get_help_extra` (`src/click/core.py`); a new bounded type should too.

## Standing criteria

- The existing test suite still passes; a new public feature follows the Conventions above.
- User-facing errors go through `self.fail(...)` with `_()`-wrapped messages, never a traceback.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs, changelog); anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Probe conversion through a real command with `CliRunner` (exit code 2 and a `Usage:` error), not only `convert()` directly.
- `to_info_dict()` and `repr()` work. `to_info_dict()` returns raw Python values the way the siblings do (`IntRange` min/max, `Choice` enum members); it isn't documented as JSON-safe, so a non-JSON value there is not a finding.
