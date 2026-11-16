# Feature flow: click

Kind: Python library (CLI framework).

## Checks
- `.venv/bin/pytest -q`
- `.venv/bin/mypy`
- `.venv/bin/ruff check`
- `.venv/bin/ruff format --check`
- CI also runs `pyright --verifytypes click` and a sphinx docs build (sphinx isn't installed in `.venv`)

## Conventions
- New parameter type: class in `src/click/types.py` (and its `__all__` if present), re-exported in `src/click/__init__.py`, tests in `tests/test_types.py` (or a sibling test file), documented in `docs/parameter-types.md` and `docs/api.md`, changelog entry under the unreleased version in `CHANGES.md`.
- Errors from types go through `self.fail(...)` so they surface as usage errors.

## Standing criteria
- No new dependencies; public API typed (mypy clean).

## Reviewer checklist
- Help/metavar and `to_info_dict` behave like the sibling type.
- Docs and changelog match the code.
