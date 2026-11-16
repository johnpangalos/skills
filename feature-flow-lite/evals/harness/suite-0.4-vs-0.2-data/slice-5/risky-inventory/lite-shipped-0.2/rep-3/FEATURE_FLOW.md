# Feature Flow: shop

## Kind

Existing codebase of a library: Python 3, standard library only (checkout logic for a coffee shop).

## Checks

- Full: `./check.sh` (ruff E,F,W on shop/ and tests/ if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -v`
- Run it: `python3 -c "from shop.<module> import ...; ..."` from the repo root

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; SKUs validated through `shop.catalog` (`lookup` / `PRODUCTS`, raising `UnknownProduct`); tests in `tests/test_<name>.py` as `unittest.TestCase`; one line in README.md describing the feature.
- No third-party dependencies.

## Standing criteria

- `./check.sh` passes.
- A new public feature follows the Conventions above.
- Code reachable from checkout is safe to call from many threads at once (checkout runs in a thread pool).

## Reviewer checklist

- The change follows the patterns around it (naming, catalog validation, error wording, tests location, README line).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Concurrency: hammer shared state from many threads (barrier-started) and check invariants; check-then-act races are blocking.
- Integer inputs: bool, float, str, None, 0, negative and huge values.
- Handles/tokens the library issues (e.g. Reservation) are matched by identity, not `==`/hash: probe with a subclass overriding `__eq__`/`__hash__` and an unhashable subclass.
