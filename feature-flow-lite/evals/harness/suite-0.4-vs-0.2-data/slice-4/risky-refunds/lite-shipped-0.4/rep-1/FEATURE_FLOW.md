# Feature Flow project file

Kind: small Python library (stdlib only), package `shop/`, tests in `tests/` (unittest).

## Checks
- `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)

## Conventions
- Money is Decimal dollars; round with `shop.money.to_cents` / `CENT`.
- One test module per shop module: `tests/test_<module>.py`, unittest.TestCase.
- Errors are ValueError (or subclasses) with a short message.

## Standing criteria
- No new dependencies. `./check.sh` passes.

## Reviewer checklist
- Every new behavior has a test; no unrelated edits.
- Money: no floats, whole cents, Decimal inputs validated.
