# Feature Flow: @acme/ui

## Kind

Library: accessible React 19 component library in TypeScript; Vitest + jsdom + Testing Library.

## Checks

- Full: `pnpm test`, then `pnpm typecheck`
- Targeted: `pnpm vitest run src/<Component>.test.tsx`
- Run it: render the component in a Vitest test with `@testing-library/react` and drive it with `@testing-library/user-event`

## Conventions

- New component: `src/<Component>.tsx`, exported (component + props types) from `src/index.ts`, tests in `src/<Component>.test.tsx`, a README section documenting props and keyboard behavior.
- No CSS framework or runtime dependencies; components are style-agnostic (accept `className`/rest props, no inline layout styles beyond what behavior needs).

## Standing criteria

- `pnpm test` and `pnpm typecheck` pass.
- A new public component follows the Conventions above.
- Ids used for ARIA relationships come from `useId()` so multiple instances on one page don't collide.

## Reviewer checklist

- ARIA roles, states and relationships match the WAI-ARIA Authoring Practices pattern for the component; check them in the DOM, not the source.
- Keyboard behavior matches the README; every documented key is covered by a test.
- Controlled and uncontrolled modes both work; a controlled component that ignores `onChange` doesn't change its own state.
- Two instances on one page don't share ids or state.
- README props tables match the exported prop types.
- Focus management: clicking non-focusable chrome (backdrops, popups) must not drop focus to `<body>`; state that changes after rerender (an option or tab becoming disabled) is re-checked before acting on it.
