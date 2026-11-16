# Feature Flow project file

Kind: Python library (Click).

## Checks
- `.venv/bin/pytest -q`
- `.venv/bin/mypy`
- `.venv/bin/ruff check`
- `.venv/bin/ruff format --check`

## Conventions
- New parameter type: class in `src/click/types.py` (add to that module's public names), export in `src/click/__init__.py`, document in `docs/parameter-types.md` and `docs/api.md`, tests in `tests/test_types.py` / `tests/test_basic.py`.
- Every user-visible change gets an entry under the unreleased version at the top of `CHANGES.md`.

## Standing criteria
- Bad user input fails with a `click.BadParameter`/usage error (exit 2), never a traceback.
- New types implement `to_info_dict` and help/metavar consistently with siblings.

## Reviewer checklist
- Changelog, docs and exports match the code.
- Tests cover every new behavior and the error paths.
- No unrelated edits.
