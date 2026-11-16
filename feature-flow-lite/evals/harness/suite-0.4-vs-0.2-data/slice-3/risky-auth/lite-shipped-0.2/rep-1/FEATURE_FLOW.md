# Feature Flow: shop

## Kind

existing codebase of a Python library (standard library only, no dependencies)

## Checks

- Full: `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -q`
- Run it: `python3 -c "from shop.<module> import ...; ..."`

## Conventions

- Module change: code in `shop/<module>.py`, tests in `tests/test_<module>.py` (unittest.TestCase classes); user-facing rules documented in README.md.
- Time-dependent code takes an injectable `now=None` (Unix seconds, `None` means `time.time()`) so tests never sleep.

## Standing criteria

- The existing test suite still passes; standard library only.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, docstrings, README rules); anything the sibling named in FILES does that the new code should and doesn't is a finding.
- `now=0` / falsy values are not treated as "use the default".
- Security checks such as expiry fail closed: a NaN timestamp must not get past a comparison.
