# Feature Flow project file
## Kind
Python stdlib-only library (`shop/`), unittest tests in `tests/`.
## Checks
./check.sh   (ruff E,F,W if present else compileall; then unittest discover)
## Conventions
- New module -> `tests/test_<module>.py` using unittest.TestCase.
- README's first paragraph lists what the repo covers; add new areas there.
- Validate ints with `type(x) is int` (reject bool), unlike cart.py.
## Standing criteria
- Standard library only.
## Reviewer checklist
- Shared mutable state guarded by a lock when the request says threads.
- Tests for every new behavior, including error paths.
