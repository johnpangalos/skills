# Feature Flow: shop

## Kind

Existing codebase of a library: Python 3 checkout logic, standard library only.

## Checks

- Full: `./check.sh` (ruff E,F,W on shop and tests, then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -q`
- Run it: `python3 -c "from shop.cart import Cart; ..."` (library; probe from a script)

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; tests in `tests/test_<name>.py` as `unittest.TestCase` classes.
- Money is `Decimal` dollars rounded to cents with `shop.money.to_cents`; never floats.
- Module-specific errors are exception classes defined in the module (e.g. `auth.InvalidToken`, `catalog.UnknownProduct`).
- Standard library only; no new dependencies.
- README describes the behavior rules (shipping, tax); a new money rule gets a line there.

## Standing criteria

- `./check.sh` passes; the existing test suite still passes.
- No new dependencies; money stays `Decimal`.

## Reviewer checklist

- The change follows the patterns around it (naming, module docstring, errors defined in the module, tests in tests/test_<name>.py).
- Hostile Decimal inputs: NaN, sNaN, Infinity, -0, huge exponents (e.g. `Decimal("1E+1000")`), sub-cent values; each must give the module's error, never `decimal.InvalidOperation` or `TypeError`.
- Money validation also under a `decimal.localcontext()` with Inexact/Rounded trapped and with a Decimal subclass; catch `DecimalException`, not just `InvalidOperation`.
- A failed operation leaves state unchanged.
