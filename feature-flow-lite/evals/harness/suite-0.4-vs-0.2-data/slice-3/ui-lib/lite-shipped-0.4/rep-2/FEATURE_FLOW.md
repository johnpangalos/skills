# Feature Flow project file

Kind: TypeScript React component library (React 19), no build step, source exported from `src/index.ts`.

## Checks
- `pnpm test` (vitest, jsdom, Testing Library + user-event)
- `pnpm typecheck` (tsc --noEmit)

## Conventions
- One component per folder/file under `src/`, re-exported from `src/index.ts` with its prop types.
- Tests live beside the component as `*.test.tsx`, using `@testing-library/user-event` for keyboard/mouse.
- Style-agnostic: no CSS framework, no runtime dependencies beyond react/react-dom; accept `className`/rest props.
- README documents every component's props and keyboard behavior.

## Standing criteria
- Follows the relevant WAI-ARIA Authoring Practices pattern; roles and aria-* attributes are tested.
- IDs generated with `useId`, so multiple instances on a page don't collide.

## Reviewer checklist
- Controlled and uncontrolled modes both tested where offered.
- No new dependencies; typecheck clean under strict.
