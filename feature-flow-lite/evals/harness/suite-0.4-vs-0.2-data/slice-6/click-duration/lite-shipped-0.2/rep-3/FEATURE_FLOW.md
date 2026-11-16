# Feature Flow: Click

## Kind

Existing codebase of a Python library (Click, CLI framework), src layout, pytest.

## Checks

- Full: `.venv/bin/pytest`; `.venv/bin/ruff check`; `.venv/bin/ruff format --check`;
  `.venv/bin/mypy`; `.venv/bin/pyright --ignoreexternal --verifytypes click` (CI's typing env)
- Targeted: `.venv/bin/pytest tests/test_types/test_<Type>.py`
- Run it: `.venv/bin/python -c 'import click; ...'` with `click.testing.CliRunner`, or a small
  script in the scratchpad run with `.venv/bin/python`

## Conventions

- Every change: entry in `CHANGES.md` under the top `Unreleased` version, MyST roles
  (`{class}`, `{pr}`/`{issue}`), wrapped at ~80 columns.
- New parameter type: class in `src/click/types.py` (with `to_info_dict`, `__repr__`, docstring
  with `.. versionadded::`), re-export in `src/click/__init__.py` (alphabetical
  `from .types import X as X`), autoclass in `docs/api.md` types section and in the
  "Built-in Types Listing" of `docs/parameter-types.md`, tests in `tests/test_types/test_<Type>.py`,
  an info-dict case in `tests/test_info_dict.py`.
- Range-like types show their range in `--help` via `Option.get_help_extra` in `src/click/core.py`
  and fail with `"{value} is not in the range {range}."`.

## Standing criteria

- The existing test suite and every check under Checks still pass.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs, changelog); anything
  the sibling named in FILES does that the new code should and doesn't is a finding.
- Bad user input surfaces as `click.BadParameter` / usage error (exit code 2, message on stderr),
  never a traceback; probe through `CliRunner` with `standalone_mode` default.
- Run every `click:example`/`click:run` block added to `docs/` and check each `invoke` shows
  what the prose says it does (a success case must actually succeed).
