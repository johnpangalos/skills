# Feature Flow: react-spectrum monorepo

## Kind

Existing codebase of a library: TypeScript React hooks/components (React Aria, React Stately, Spectrum), Jest + jsdom.

## Checks

- Full: `yarn jest <touched package dirs>`; `yarn eslint <touched files>`; `yarn check-types`
- Targeted: `yarn jest packages/@react-aria/<pkg>/test/<file>`
- Run it: no app to start; behavior is probed with jsdom tests.

## Conventions

- Behavior behind the shadow DOM flag: branch on `shadowDOM()` from `@react-stately/flags`; tests call `enableShadowDOM()` and reset in `afterEach`; reuse helpers from `@react-aria/utils` (`getRootNode`, `nodeContains`, `ShadowTreeWalker`).
- Tests live in the package's `test/` folder next to the existing file for that module.
- Shadow DOM tests go at the end of the module's existing test file as `describe('... with Shadow DOM')` with `enableShadowDOM()` in `beforeAll` (the flag can't be turned off).
- A new package dependency also needs the `yarn.lock` update (CI runs `yarn install --immutable`).
- No CHANGELOG edits (release tooling generates them).

## Standing criteria

- Behavior with feature flags off is unchanged.
- Public API signatures unchanged unless the request says so.
- New dependencies are declared in the package's package.json.

## Reviewer checklist

- Flag-off path is byte-for-byte the old behavior; existing tests pass untouched.
- Cleanup functions restore every attribute they set and disconnect every observer.
- Nested/stacked calls (refcounts, observer stacks) keep working.
- jsdom limitations (no top layer, partial shadow DOM) don't hide gaps the tests claim to cover.
