# Feature Flow project file

## Kind
Monorepo of React UI libraries (React Aria / React Spectrum), TypeScript, yarn workspaces.

## Checks
- Targeted tests: `yarn jest <path>`
- Lint: `yarn eslint` (or `yarn eslint <path>` while working)
- Types: `yarn check-types`
- Lockfile: `yarn install --immutable --mode=skip-build` (CI runs `yarn --immutable`)
- Note: repo-wide `yarn eslint` crashes on `.chromatic/constants.js` (rulesdir/imports fixer) at base commit b8f8d1d; lint changed packages with `npx eslint <path>`.

## Conventions
- Tests live in each package's `test/` folder next to the existing tests for the module.
- Shadow DOM behavior is gated on `shadowDOM()` from `@react-stately/flags`. The flag cannot be turned off, so shadow DOM tests go in a trailing `describe('... with Shadow DOM')` in the existing test file, with `beforeAll(() => enableShadowDOM())` (see FocusScope.test.js, usePress.test.js).
- Use the shadow-DOM-aware helpers in `@react-aria/utils` (`nodeContains`, `getRootNode`, `createShadowTreeWalker`, ...) instead of raw DOM APIs.
- Packages must declare every workspace package they import in `package.json`, and `yarn.lock` must be updated in the same change.

## Standing criteria
- Behavior with the shadow DOM flag off is unchanged.
- New behavior has tests.

## Reviewer checklist
- No unrelated edits; copyright header on new files.
- Imports from other packages are declared as dependencies.
- Restore/cleanup functions undo everything they did (attributes, observers, global stacks).
