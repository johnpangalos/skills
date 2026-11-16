# Feature Flow: react-spectrum monorepo

## Kind

Existing TypeScript/React library monorepo (react-aria, react-stately, react-spectrum), yarn workspaces, jest.

## Checks

- Full: `yarn check-types`; `yarn eslint <changed paths>`; `yarn jest packages/@react-aria/overlays`
- Targeted: `yarn jest packages/@react-aria/overlays/test/ariaHideOutside.test.js`
- Run it: none (library); probe with jest tests using `createShadowRoot` from `@react-spectrum/test-utils-internal`

## Conventions

- Shadow DOM behavior is gated on `shadowDOM()` from `@react-stately/flags` (enabled with `enableShadowDOM()`); helpers live in `packages/@react-aria/utils/src/shadowdom/` (`nodeContains`, `createShadowTreeWalker`, `getActiveElement`).
- Tests sit next to the existing ones in the package's `test/` folder; shadow DOM tests call `enableShadowDOM()` and use `createShadowRoot()`.
- Every source file keeps its Apache license header.

## Standing criteria

- With the shadow DOM flag off, behavior is identical to before.
- `yarn check-types` and `yarn eslint` pass on changed files; new behavior has tests.

## Reviewer checklist

- Flag off: the light-DOM code path is unchanged.
- Cleanup function restores every hidden node (aria-hidden and inert) and disconnects every observer, including those on shadow roots.
- Nested ref counting and the observer stack still work with several `ariaHideOutside` calls.
