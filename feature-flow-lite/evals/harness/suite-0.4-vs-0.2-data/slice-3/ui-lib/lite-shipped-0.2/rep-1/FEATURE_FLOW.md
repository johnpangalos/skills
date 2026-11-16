# Feature Flow: @acme/ui

## Kind

library; TypeScript React 19 component library (accessible, style-agnostic), Vitest + jsdom + Testing Library

## Checks

- Full: `pnpm test`, then `pnpm typecheck`
- Targeted: `pnpm vitest run src/<Component>.test.tsx`
- Run it: render components in a Vitest test with `@testing-library/react` and drive them with `@testing-library/user-event`

## Conventions

- New component: `src/<Component>.tsx`, exported (component and its props types) from `src/index.ts`, tests in `src/<Component>.test.tsx`, a README section listing props and keyboard behavior.
- No runtime dependencies beyond react/react-dom; no CSS framework or inline visual styles; forward `className` and other native props where a component renders a DOM element.

## Standing criteria

- `pnpm test` and `pnpm typecheck` pass.
- Every public component and props type is exported from `src/index.ts` and documented in README.md.
- Components follow the matching WAI-ARIA Authoring Practices pattern (roles, states, keyboard).
- IDs come from `useId`, so two instances on one page never collide.

## Reviewer checklist

- Keyboard behavior matches the README for every key it lists, including disabled items and wrap-around.
- ARIA attributes reference IDs that exist in the DOM; no duplicate IDs with two instances rendered.
- Controlled and uncontrolled modes both work; a controlled component whose parent ignores the change does not change.
- The change follows the Conventions above (file layout, exports, README).
- Composition: components nested in each other (Combobox in Dialog, Dialog in Dialog) — React events bubble through portals, so a key one component handles (Escape, Tab) must not also trigger an enclosing one.
- State derived from the DOM updates when children add or remove items from their own state, without the parent re-rendering.
