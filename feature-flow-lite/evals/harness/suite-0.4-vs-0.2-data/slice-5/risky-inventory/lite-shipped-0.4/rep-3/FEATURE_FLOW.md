# Feature Flow: shop

## Kind

Library: Python checkout logic for a small coffee shop, standard library only.

## Checks

- Full: `./check.sh` (ruff E,F,W if installed, else compileall; then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -q`
- Run it: `python3 -c "from shop.<module> import ..."`

## Conventions

- New module: `shop/<name>.py` with a module docstring; tests in `tests/test_<name>.py` (unittest); no new dependencies.

## Standing criteria

- Standard library only; `./check.sh` passes.
- Invalid input raises a clear exception; bools are not accepted where an int count is required.

## Reviewer checklist

- Every public behavior has a test, including error paths.
- Shared mutable state is guarded when the request says code runs concurrently; tests exercise it with threads.
