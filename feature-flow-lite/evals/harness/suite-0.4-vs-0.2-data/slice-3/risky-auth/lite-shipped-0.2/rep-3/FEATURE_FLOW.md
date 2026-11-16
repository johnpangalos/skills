# Feature Flow: shop

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase of a small Python library (checkout logic for a coffee shop); standard
library only, unittest.

## Checks

- Full: `./check.sh` (ruff E,F,W on shop and tests if installed, else compileall; then
  `python3 -m unittest discover -s tests -t . -q`)
- Targeted: `python3 -m unittest tests.test_<module> -v`
- Run it: `python3 -c "from shop.<module> import ...; ..."` from the repo root

## Conventions

- Any module change: tests in `tests/test_<module>.py`, unittest.TestCase classes.
- Business rules (amounts, thresholds, limits) are stated in README.md; a new or changed rule
  gets a sentence there.
- Errors are module-level Exception subclasses with a plain `pass` body (see
  `shop/catalog.py` UnknownProduct, `shop/auth.py` InvalidToken).
- Functions that depend on the clock take an optional `now` parameter so tests are
  deterministic; `now=None` means "use the real clock" (check `is None`, never truthiness).

## Standing criteria

- `./check.sh` passes.
- Standard library only; no new dependencies.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, exception style, README rule sentence,
  tests in the matching test file).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Boundary values for every limit (exactly at, just past) are tested.
- Optional parameters with falsy legitimate values (0, empty string) are honored.
- Check-then-act on module-level state (e.g. single-use marks) is atomic under concurrent
  callers; probe by forcing interleaving between the check and the write.
