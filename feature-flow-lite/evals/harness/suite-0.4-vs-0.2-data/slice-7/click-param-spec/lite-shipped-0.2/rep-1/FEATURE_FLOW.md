# Feature Flow: Click

## Kind

Existing codebase of a library: Python CLI framework (src/click), Sphinx/MyST docs.

## Checks

- Full: `.venv/bin/pytest`; `.venv/bin/ruff check`; `.venv/bin/ruff format --check`; `.venv/bin/mypy` (CI also runs pyright via `tox -e typing`)
- Targeted: `.venv/bin/pytest tests/test_options.py tests/test_arguments.py tests/test_deprecations.py`
- Run it: `.venv/bin/python -c "import click; ..."` or `click.testing.CliRunner` in a probe script

## Conventions

- New public API or deprecation: `CHANGES.md` entry under the topmost unreleased version with `{pr}`/`{issue}` refs and `{meth}`/`{class}` roles; deprecations also go in `docs/upgrade-guides.md` under "Deprecations"; docstrings carry `.. versionadded::`/`.. versionchanged::`/`.. deprecated::` with the unreleased version.
- Tests live in `tests/test_<module or area>.py`; deprecation behavior in `tests/test_deprecations.py`. pytest runs with `filterwarnings = error`, so any stray warning fails tests.
- `warnings` and `keyword` are imported locally inside functions in `core.py` (tests/test_imports.py holds the import allow-list).
- Deprecation warnings use `stacklevel=_outside_click_stacklevel()`.

## Standing criteria

- The existing test suite still passes with warnings as errors.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, docstrings with version directives, docs, changelog).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- No new module-level imports outside the allow-list in tests/test_imports.py.
- A new warning's `filename` points at the user's file. `Parameter` uses ABCMeta, so a warning raised from a class hook needs `_outside_click_stacklevel(skip=("abc",))`.
- Every claim in docs or CHANGES text holds when it's actually run, e.g. the exact error message a CLI prints.
