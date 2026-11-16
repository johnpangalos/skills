# Feature Flow: React Spectrum / React Aria monorepo

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase: TypeScript React component/hook library monorepo (yarn workspaces, jest + jsdom).

## Checks

- Full: `yarn jest <packages touched>` (CI: `yarn test` = STRICT_MODE=1 VIRT_ON=1 jest, split across all packages), `yarn check-types`, `yarn eslint <paths touched>` (CI: `yarn lint`)
- Targeted: `yarn jest packages/@react-aria/<pkg>/test/<file>`
- Run it: no app to start; probe behavior with a jest test (jsdom supports attachShadow and MutationObserver).

## Conventions

- No CHANGELOG entries; changes land as `fix:`/`feat:` commits.
- Tests live in `packages/@<scope>/<pkg>/test/`, next to the existing tests for the same module.
- Shadow DOM support is gated on `enableShadowDOM()` / `shadowDOM()` from `@react-stately/flags`; use the helpers in `@react-aria/utils` (`nodeContains`, `getRootNode`, `getOwnerDocument`, `createShadowTreeWalker`) rather than raw DOM APIs. Tests that turn the flag on reset it after.

## Standing criteria

- The existing test suite, `yarn check-types` and `yarn eslint` still pass.
- Behavior with the shadow DOM flag off is unchanged.

## Reviewer checklist

- The change follows the patterns around it (naming, flag gating, utils helpers, test layout).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- A new dependency in any package.json needs the matching yarn.lock update: CI runs `yarn install --immutable`; also run `yarn constraints` and `node scripts/lint-packages.js`.
- Tests clean up global state (flags, attached shadow hosts, observers) so they don't leak into other tests.
