# Feature flow project file

## Kind
Small Python library (`shop/`), stdlib only.

## Checks
- `./check.sh` (ruff E,F,W or compileall, then `python3 -m unittest discover -s tests -t . -q`)

## Conventions
- Tests live in `tests/test_<module>.py`, unittest style.
- No new dependencies.

## Standing criteria
- `./check.sh` passes.

## Reviewer checklist
- New behavior has tests; no unrelated edits.
