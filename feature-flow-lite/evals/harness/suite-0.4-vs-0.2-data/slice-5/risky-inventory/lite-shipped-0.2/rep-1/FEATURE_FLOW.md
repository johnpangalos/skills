# Feature Flow: shop

## Kind

Existing codebase of a library: Python 3, standard library only (checkout logic for a coffee shop).

## Checks

- Full: `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -v`
- Run it: `python3 -c 'from shop.<module> import ...'` from the repo root

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; tests in `tests/test_<name>.py` using `unittest.TestCase`; no new dependencies.
- SKUs are validated against `shop.catalog` (`lookup` / `PRODUCTS`), raising `UnknownProduct`.
- New user-facing area: mention it in the README's one-paragraph summary.

## Standing criteria

- `./check.sh` passes; the existing test suite still passes.
- Standard library only.
- Checkout runs in a thread pool: any shared mutable state is safe under concurrent calls.

## Reviewer checklist

- The change follows the patterns around it (naming, docstrings, catalog validation, error types).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Concurrency: hammer shared state from many threads (ThreadPoolExecutor) and check invariants hold exactly.
- `bool` is an `int` subclass: integer-only parameters must reject `True`/`False`.
