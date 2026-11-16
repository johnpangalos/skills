# Feature Flow: shop

## Kind

Existing codebase of a small Python library (checkout logic, password-reset tokens); standard
library only.

## Checks

- Full: `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -v`
- Run it: `python3 -c "from shop import <module>; ..."` (library, no entry point)

## Conventions

- Module change: code in `shop/<module>.py`, unittest tests in `tests/test_<module>.py`
  (`unittest.TestCase`, one class per feature). No changelog; README only for user-facing
  business rules (prices, shipping, tax).
- Time-dependent code takes an optional `now` (Unix seconds) defaulting to `time.time()`, so
  tests pass explicit timestamps instead of sleeping or patching.

## Standing criteria

- `./check.sh` passes; no new third-party dependencies.
- Existing public names and call shapes keep working.

## Reviewer checklist

- The change follows the patterns around it (naming, exceptions subclassing the module's base
  error, tests in `tests/test_<module>.py`).
- Optional numeric arguments are checked with `is None`, never truthiness (`now=0` is valid).
- Boundary values in time or money rules are tested on both sides.
- Security time checks fail closed: a NaN timestamp must deny, not allow (write `not x <= limit`).
- Each new test would fail if the check it covers were removed (mutation-check the guards).
