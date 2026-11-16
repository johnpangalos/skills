# Feature Flow: react-spectrum monorepo

## Kind

Existing codebase of a library: TypeScript/React monorepo (React Aria, React Stately, React Spectrum), Yarn workspaces.

## Checks

- Full: `yarn jest`, `yarn eslint packages` (bare `yarn eslint` crashes on .chromatic at base), `node scripts/lint-packages.js`, `yarn check-types`
- Targeted: `yarn jest packages/@react-aria/<pkg>` (or a single test file path)
- Run it: none needed for library changes; tests use jsdom via jest.

## Conventions

- Tests live in `packages/<scope>/<pkg>/test/`, next to existing tests of the same module.
- Shadow DOM behavior is gated on `shadowDOM()` from `@react-stately/flags`; tests call `enableShadowDOM()` and reset in `afterEach`. Helpers like `nodeContains`, `getOwnerDocument`, shadow tree walkers live in `@react-aria/utils`.
- Shadow DOM tests go at the end of the existing test file as `describe('X with Shadow DOM')` calling `enableShadowDOM()` in `beforeAll` (the flag has no reset); never a separate file.
- Every source file keeps the Adobe license header.

## Standing criteria

- Behavior with feature flags off is unchanged.
- New behavior has tests; no new dependencies.

## Reviewer checklist

- Flag-off path is byte-for-byte equivalent in behavior to the base.
- Cleanup functions undo everything they did (attributes, observers, ref counts).
- `yarn eslint` and `yarn check-types` pass.
