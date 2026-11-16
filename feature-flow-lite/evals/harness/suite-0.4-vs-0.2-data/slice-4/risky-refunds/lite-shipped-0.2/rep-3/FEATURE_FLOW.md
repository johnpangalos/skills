# Feature Flow: shop

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase: small Python library (coffee-shop checkout), standard library only.

## Checks

- Full: `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -q`
- Run it: `python3 -c "from shop.<module> import ...; ..."` from the repo root

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; tests in `tests/test_<name>.py` using `unittest.TestCase`.
- Money is `Decimal` dollars; round/quantize through `shop/money.py` (`to_cents`, `CENT`), never float.
- Module errors are module-level exception classes subclassing a builtin (`UnknownProduct(KeyError)`, `InvalidToken(Exception)`).
- In-memory state lives in module-level dicts (see `shop/auth.py`); no new dependencies.
- New user-facing behavior gets a line in README.md.

## Standing criteria

- `./check.sh` passes.
- Standard library only; no new dependencies.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, docstrings, money via `shop/money.py`, tests in `tests/`).
- Money inputs: floats, ints, strings, NaN/Infinity, sub-cent and negative-zero Decimals.
- Money inputs, round two: Decimal subclasses, 30+ and 5000+ digit amounts, `1E+1000000`, and a caller `decimal.localcontext(prec=3)`; validation must still raise only the module's own error.
- Money totals that must hold an invariant (caps, balances): concurrent callers on the same object.
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
