# Feature Flow: Click

## Kind

Existing codebase of a library: Python CLI framework (`src/click`), pytest, mypy, ruff.

## Checks

- Full: `.venv/bin/pytest -q`; `.venv/bin/mypy`; `.venv/bin/ruff check`; `.venv/bin/ruff format --check`
- Targeted: `.venv/bin/pytest -q tests/test_options.py` (or the test file for the code changed)
- Run it: `.venv/bin/python -c 'import click; ...'` or `click.testing.CliRunner().invoke(cmd, [...])`

## Conventions

- Any user-visible change: entry in `CHANGES.md` under the unreleased version at the top, with `{pr}`/`{issue}` roles and `{meth}`/`{class}` references.
- Deprecation: `DeprecationWarning` via a local `import warnings` (`tests/test_imports.py` holds Click's import footprint), an entry under "Deprecations" in `docs/upgrade-guides.md` saying how to migrate, and a `.. deprecated::` / `.. versionadded::` / `.. versionchanged::` directive in the docstring.
- Tests live in `tests/test_<area>.py` (options, arguments, deprecations, basic), as plain pytest functions using `CliRunner`.

## Standing criteria

- The existing test suite still passes; new public API has a docstring with a version directive and a `CHANGES.md` entry.
- No new module-level imports in `src/click` beyond what `tests/test_imports.py` allows.

## Reviewer checklist

- The change follows the patterns around it (naming, docstring directives, docs, changelog, upgrade guide).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- CI runs Python 3.10–3.14 and PyPy, but `.venv` is 3.13: tests must not match interpreter messages that differ across versions (e.g. a property's `AttributeError` text).
- Warnings point at user code (`stacklevel`), and Click itself triggers none of the warnings it adds (run the suite with `-W error::DeprecationWarning` on the new warning).
