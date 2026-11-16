# Feature Flow: @acme/ui

## Kind

library: accessible React 19 component library in TypeScript (Vitest + jsdom + Testing Library)

## Checks

- Full: `pnpm test`, then `pnpm typecheck`
- Targeted: `pnpm vitest run src/<Component>` (one test file or folder)
- Run it: library only; render components in a Vitest test with `@testing-library/react` and drive them with `@testing-library/user-event`

## Conventions

New component: `src/<Component>.tsx` (or `src/<Component>/`), exported from `src/index.ts`, tests in `src/<Component>.test.tsx`, props and keyboard behavior documented in a README.md section.

## Standing criteria

- `pnpm test` and `pnpm typecheck` pass; no new dependencies; no CSS framework or inline layout styles (style-agnostic; consumers pass `className`).
- Every public component and prop type is exported from `src/index.ts` and documented in README.md.
- ARIA roles, states and keyboard behavior follow the WAI-ARIA Authoring Practices pattern for the widget; generated ids use `React.useId` so multiple instances on a page don't collide.

## Reviewer checklist

- Keyboard-only use of every component works; focus is never lost to `document.body`.
- Controlled and uncontrolled modes both work where the API offers them; a controlled component whose parent ignores the change does not change its own state.
- Two instances on one page have distinct ids and don't interfere.
- README props tables and keyboard tables match the code.
- Nested widgets (Combobox in Dialog, Dialog in Dialog): a key the inner widget handles (Escape) is marked with `preventDefault` and the outer one ignores it.
- Consumer handlers passed through `...rest` (`onKeyDown`, `onBlur`, `onClick`) are chained, not silently overridden.
- Tests query by role and accessible name, and drive input with `user-event`, not by reading the source.
