# Feature Flow: @acme/ui

## Kind

library: accessible React 19 component library, TypeScript, Vitest + jsdom + Testing Library.

## Checks

- Full: `pnpm test`, `pnpm typecheck`
- Targeted: `pnpm vitest run src/<Component>`
- Run it: render in a Vitest test with `@testing-library/react` and `user-event`.

## Conventions

- New component: `src/<Component>/<Component>.tsx` (no per-folder index.ts), tests in `src/<Component>/<Component>.test.tsx`, exported (component and props types) from `src/index.ts`, documented in README (props table + keyboard table).

## Standing criteria

- Style-agnostic: no CSS framework, no inline layout styles beyond what behaviour needs; `className` and native props pass through.
- No new runtime dependencies.
- Generated ids use `React.useId`, so multiple instances don't collide.

## Reviewer checklist

- Roles, aria-* attributes and id references match the WAI-ARIA APG pattern.
- Keyboard behaviour tested with `user-event`, not by calling handlers.
- Controlled and uncontrolled modes both tested; controlled mode doesn't change state without the parent.
- README props and keyboard tables match the code.
