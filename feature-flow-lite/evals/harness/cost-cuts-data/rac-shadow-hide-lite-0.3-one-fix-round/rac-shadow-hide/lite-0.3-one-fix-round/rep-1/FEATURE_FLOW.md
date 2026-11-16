# Feature Flow: react-spectrum

## Kind

Existing codebase: TypeScript/React monorepo of libraries (React Aria, React Stately, React Spectrum), Yarn workspaces, Jest + Testing Library.

## Checks

- Full: `yarn test <changed packages>` (STRICT_MODE=1 VIRT_ON=1 jest; CI runs the whole suite), `yarn test:ssr`, `yarn check-types`, `yarn eslint <changed paths>` (CI: `yarn lint`)
- Targeted: `yarn jest packages/@react-aria/<pkg>/test/<file>`
- Also: `yarn install --immutable` (CI runs it; a new workspace dependency needs its yarn.lock entry). Run `yarn check-types` alone: it gets OOM-killed beside jest. A plain `yarn install` here re-applies `patches/@mdx-js+react*` and duplicates line 2 of `node_modules/@mdx-js/react/lib/index.d.ts`, breaking check-types; delete the duplicate.
- Run it: no app to start; probe behavior with a jest test in jsdom (create shadow roots with `attachShadow({mode: 'open'})`)

## Conventions

- Bug fix / behavior change in a hook or utility: source in `packages/@react-aria/<pkg>/src`, tests beside the existing ones in `packages/@react-aria/<pkg>/test`; no changelog file (release notes are written at release time).
- Shadow DOM behavior is gated behind `shadowDOM()` from `@react-stately/flags`; tests turn it on with `enableShadowDOM()` and reset it after.
- Every source file carries the Adobe Apache-2.0 copyright header.

## Standing criteria

- The existing test suite still passes; behavior with flags off is unchanged.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, helpers from `@react-aria/utils`, flag gating, test placement).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- No new dependencies unless declared in the package's package.json.
