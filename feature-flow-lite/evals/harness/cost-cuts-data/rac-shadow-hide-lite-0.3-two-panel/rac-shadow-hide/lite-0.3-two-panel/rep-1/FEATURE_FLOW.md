# Feature Flow: react-spectrum

## Kind

Existing codebase of a library: TypeScript monorepo (React Aria, React Stately, React Spectrum), yarn workspaces, Jest + jsdom.

## Checks

- Full: `yarn test <changed package dirs>` (CI runs `yarn test` = `STRICT_MODE=1 VIRT_ON=1 jest` over all `packages/**/*.test.*`), `yarn eslint <changed package dirs>`, `yarn check-types`
- Targeted: `yarn jest packages/@react-aria/<pkg>/test/<file>`
- Run it: no app to run for a utility; probe with a jest test (jsdom supports `attachShadow` and `MutationObserver`).

## Conventions

- No changelog entries; release notes are generated. Tests live in `packages/<scope>/<pkg>/test/<name>.test.{js,ts,tsx}` next to the existing tests for that module.
- Shadow DOM support is gated on `shadowDOM()` from `@react-stately/flags` (turned on with `enableShadowDOM()`); shadow-aware helpers live in `@react-aria/utils` (`nodeContains`, `getActiveElement`, `getEventTarget`, `createShadowTreeWalker`). With the flag off, behavior must be identical to before.
- New cross-package imports must be declared in the importing package's `package.json` dependencies (`yarn constraints` checks this).

## Standing criteria

- The existing test suite still passes; `yarn eslint` and `yarn check-types` pass.
- Behavior with feature flags off is unchanged.

## Reviewer checklist

- The change follows the patterns around it (naming, flag gating, shared utils in `@react-aria/utils` rather than copies).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Tests that turn on a global flag restore it afterwards so other tests in the file aren't affected. `enableShadowDOM()` can't be undone, so shadow DOM tests go in a last `describe` with `beforeAll(enableShadowDOM)` (as in FocusScope.test.js and usePress.test.js).
- For code that takes a list of targets (e.g. `ariaHideOutside`), probe one target nested inside another, including across a shadow boundary. `DragManager` passes overlapping targets.
