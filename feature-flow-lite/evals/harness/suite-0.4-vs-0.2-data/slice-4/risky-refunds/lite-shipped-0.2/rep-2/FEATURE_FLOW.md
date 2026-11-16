# Feature Flow: shop

## Kind

Existing codebase of a library: Python 3, standard library only (checkout logic for a coffee shop).

## Checks

- Full: `./check.sh` (ruff E,F,W on shop and tests, or compileall without ruff; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -q`
- Run it: `python3 -c "from shop.cart import Cart; ..."` from the repo root

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; tests in `tests/test_<name>.py` using `unittest`; no new dependencies.
- Money is `Decimal` dollars rounded to cents with `shop.money.to_cents`/`CENT`; never floats.
- Module errors are module-level exception classes (see `shop/auth.py` `InvalidToken`, `shop/catalog.py` `UnknownProduct`).
- A new user-facing feature gets a line in README.md's description.

## Standing criteria

- The existing test suite still passes and `./check.sh` exits 0.
- No floats in money paths; amounts are `Decimal`.

## Reviewer checklist

- The change follows the patterns around it (naming, module docstring, exception classes, README).
- Money edge cases: float/int/str inputs, NaN/Infinity, sub-cent and negative amounts, totals exactly at a limit.
- A failed operation leaves state unchanged.
- Money validation and arithmetic don't depend on the caller's decimal context (low `prec`, trapped `Inexact`).
