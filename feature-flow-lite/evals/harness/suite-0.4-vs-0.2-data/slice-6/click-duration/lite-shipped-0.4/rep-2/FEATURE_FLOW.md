# Feature Flow: Click

## Kind

Existing codebase of a library: Python CLI framework (src/click).

## Checks

- Full: `.venv/bin/pytest -q`, `.venv/bin/mypy`, `.venv/bin/ruff check`, `.venv/bin/ruff format --check`
- Targeted: `.venv/bin/pytest -q tests/test_types/test_<Type>.py`
- Run it: `.venv/bin/python -c 'import click; ...'` or CliRunner in a script

## Conventions

- New parameter type: class in src/click/types.py (+ `__all__` if present), export in src/click/__init__.py, docs/parameter-types.md section + autoclass list, docs/api.md autoclass, CHANGES.md entry under the Unreleased version, tests in tests/test_types/test_<Type>.py; to_info_dict and tests/test_info_dict.py if siblings appear there.

## Standing criteria

- Errors go through `self.fail` (BadParameter/UsageError), never a traceback; exit code 2.
- Public API is typed and passes mypy.

## Reviewer checklist

- Help metavar, repr, to_info_dict consistent with sibling types.
- Docs, changelog and code agree.
- Defaults of a new type show in help and prompts in a form the user can type back in (`show_default`, `prompt=True`).
