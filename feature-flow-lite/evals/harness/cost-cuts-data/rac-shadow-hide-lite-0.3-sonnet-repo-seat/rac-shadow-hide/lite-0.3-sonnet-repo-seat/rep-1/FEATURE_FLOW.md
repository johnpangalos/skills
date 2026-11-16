# Feature Flow: React Spectrum / React Aria monorepo

## Kind

Existing codebase of a library: TypeScript + React monorepo (yarn workspaces), Jest + jsdom tests.

## Checks

- Full: `yarn jest <touched packages>` (CI: `yarn ci-test`, i.e. `STRICT_MODE=1 yarn jest`, plus `yarn test:ssr`); `yarn eslint packages` (bare `yarn eslint` crashes on `.chromatic/constants.js` in rule `rulesdir/imports` before any change; CI's `yarn lint` lints `packages`); `yarn check-types`
- Targeted: `yarn jest <path to test file or package>`
- Run it: no app to run for a probe; write a scratch jest test (jsdom supports `attachShadow`)

## Conventions

- Behavior change in a package: source in `packages/@react-aria/<pkg>/src`, tests in `packages/@react-aria/<pkg>/test/<Name>.test.{js,tsx}` next to the existing ones; no changelog file (release notes are generated).
- Shadow DOM support: gated by `shadowDOM()` / `enableShadowDOM()` from `@react-stately/flags`, using helpers in `@react-aria/utils` (`getRootNode`, `nodeContains`, `createShadowTreeWalker`, `getActiveElement`); with the flag off behavior must be unchanged.

## Standing criteria

- The existing test suite still passes; lint and type check pass.
- A new public behavior follows the Conventions above and is covered by tests.

## Reviewer checklist

- The change follows the patterns around it (naming, flag gating, shadow DOM helpers from `@react-aria/utils`, test placement).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- With the flag off, the code path is byte-for-byte the old behavior.
- Shadow DOM ports keep light-DOM parity across shadow boundaries: nothing inside a target is touched even when another target sits in a shadow root under it, and rules that apply "anywhere under root" in the light DOM (e.g. live announcers) also apply inside shadow roots.
- A package that newly imports `@react-stately/flags` must declare it in its `package.json` (`rulesdir/imports`) with the matching `yarn.lock` line.
- `@react-stately/flags` has no disable function: tests that call `enableShadowDOM()` do it in a `beforeAll` of a `describe('... with Shadow DOM')` placed after the flag-off tests (see `FocusScope.test.js`), and shadow roots come from `createShadowRoot()` in `@react-spectrum/test-utils-internal` with `cleanup()` after each test.
