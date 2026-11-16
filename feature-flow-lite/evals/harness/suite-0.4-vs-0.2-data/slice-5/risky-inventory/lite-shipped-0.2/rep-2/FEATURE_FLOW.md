# Feature Flow: shop

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase of a Python library (coffee-shop checkout logic), standard library only.

## Checks

- Full: `./check.sh` (ruff E,F,W on shop/ and tests/, then `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -v`
- Run it: `python3 -c "from shop.<module> import ...; ..."` from the repo root

## Conventions

- New module: `shop/<name>.py` with a one-line module docstring; its tests in `tests/test_<name>.py` as `unittest.TestCase` classes; a line in README.md describing what it does.
- Errors are module-level exception classes defined in the module that raises them (see `UnknownProduct` in shop/catalog.py, `InvalidToken` in shop/auth.py).
- Standard library only; no new dependencies.

## Standing criteria

- `./check.sh` passes.
- A new public feature follows the Conventions above.
- Checkout runs in a thread pool: shared mutable state must be safe to use from many threads at once.

## Reviewer checklist

- The change follows the patterns around it (naming, docstrings, error classes, README line).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Shared state: hammer it from many threads (threading.Barrier to line them up) and check the invariants hold.
