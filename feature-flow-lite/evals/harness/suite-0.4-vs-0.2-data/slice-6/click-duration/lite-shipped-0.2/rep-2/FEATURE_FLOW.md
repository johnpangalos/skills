# Feature Flow: Click

## Kind

Existing codebase of a Python library (Click, CLI framework); src layout, pytest, mypy, pyright, ruff.

## Checks

- Full: `.venv/bin/pytest`, `.venv/bin/mypy`, `.venv/bin/pyright --ignoreexternal --verifytypes click`, `.venv/bin/ruff check`, `.venv/bin/ruff format --check`
- Targeted: `.venv/bin/pytest tests/test_types/test_<Type>.py`
- Run it: `.venv/bin/python -c "import click; ..."` with `click.testing.CliRunner` for a command probe

## Conventions

- New parameter type: class in `src/click/types.py`, re-export in `src/click/__init__.py` (`from .types import X as X`, alphabetical), tests in `tests/test_types/test_<Type>.py`, a case in `tests/test_info_dict.py`, `autoclass` in `docs/api.md` and in the "Built-in Types Listing" of `docs/parameter-types.md`, changelog line under the unreleased version in `CHANGES.md` (MyST roles like {class}`X`).
- Changelog entries go under the topmost "Unreleased" version.

## Standing criteria

- The existing test suite still passes; a new public feature follows the Conventions above.
- User input errors raise `click.BadParameter` via `self.fail(...)` (exit 2, usage message), never a traceback.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs, changelog); anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Run the type through a real command with `CliRunner`: help output, a bad value, a value out of range; exit code 2 and the message on output.
- A parameter type's `convert` also receives non-string values (an `int`/`float` `default=`, an already-converted value): each must convert or fail with `self.fail`, never a traceback.
