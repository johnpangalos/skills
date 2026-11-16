# Feature Flow: Click

## Kind

Existing codebase of a library: Python CLI toolkit (src/click), pytest, mypy, ruff.

## Checks

- Full: `.venv/bin/pytest -q`; `.venv/bin/mypy`; `.venv/bin/ruff check`; `.venv/bin/ruff format --check`
- Targeted: `.venv/bin/pytest -q tests/test_options.py` (or the test file for the module changed)
- Run it: `.venv/bin/python -c "import click; ..."` or a script using `CliRunner` from `click.testing`

## Conventions

- Any user-facing change: entry in `CHANGES.md` under the topmost Unreleased version, with `{pr}`/`{issue}` role and `{class}`/`{meth}` cross-refs.
- Deprecation: `DeprecationWarning` with `stacklevel=_outside_click_stacklevel()`, listed under "Deprecations" in `docs/upgrade-guides.md`, `.. deprecated::` in the docstring.
- New public API: `.. versionadded::` in the docstring; documented in the matching `docs/*.md` page.
- Tests live in `tests/test_<module>.py` and use `pytest.warns` / `pytest.deprecated_call` for warnings.

## Standing criteria

- The existing test suite still passes, and mypy, ruff check and ruff format pass.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, docs, changelog, versionadded/deprecated directives).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- No new warning is emitted from Click's own code paths (run the suite with `-W error::DeprecationWarning` on the touched tests).
