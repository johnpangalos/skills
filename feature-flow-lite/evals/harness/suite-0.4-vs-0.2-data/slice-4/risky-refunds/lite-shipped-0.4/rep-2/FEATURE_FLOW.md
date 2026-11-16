# Feature flow: shop

Kind: Python library, standard library only.

## Checks
- `./check.sh` (ruff E,F,W or compileall, then unittest discover)

## Conventions
- New module: `shop/<name>.py` with a module docstring; tests in `tests/test_<name>.py` (unittest).
- Money is `Decimal` dollars in whole cents (`shop/money.py`); never floats.
- Errors are ValueError or subclasses with a clear message.
- README lists what the shop covers; update it when adding a module.

## Standing criteria
- No new dependencies. Every new behavior has a test.

## Reviewer checklist
- Money never float; Decimal NaN/Infinity/negative/sub-cent rejected where amounts are input.
- Failed operations change no state.
