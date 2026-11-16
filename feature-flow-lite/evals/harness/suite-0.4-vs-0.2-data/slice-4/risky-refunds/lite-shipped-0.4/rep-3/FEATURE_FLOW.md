# Feature Flow project file

Kind: small Python library (`shop`), stdlib only.

## Checks
- `./check.sh` (ruff E,F,W or compileall, then `python3 -m unittest discover -s tests -t . -q`)

## Conventions
- One module per concern in `shop/`; tests in `tests/test_<module>.py` using unittest.
- Money is Decimal dollars; round with `shop.money.to_cents`. Never use float for money.
- Errors: raise ValueError (or a ValueError subclass) with a short message.

## Standing criteria
- New behavior has unittest coverage; `./check.sh` passes.

## Reviewer checklist
- No float money; Decimal edge cases (NaN, Infinity, sub-cent, bool/int/str/float inputs).
- Failed operations leave state unchanged.
- No unrelated edits; no new dependencies.
