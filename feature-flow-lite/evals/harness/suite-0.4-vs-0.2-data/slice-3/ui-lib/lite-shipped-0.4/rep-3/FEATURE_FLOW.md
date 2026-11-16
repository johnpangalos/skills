# Feature Flow project file

Kind: TypeScript React component library (@acme/ui), React 19.

## Checks
- `pnpm test` (vitest, jsdom, Testing Library)
- `pnpm typecheck` (tsc --noEmit)

## Conventions
- Components in `src/<Name>.tsx`, exported from `src/index.ts` (components and prop types).
- Tests in `src/<Name>.test.tsx` using @testing-library/react and user-event.
- README documents each component's props and keyboard behavior.
- No runtime dependencies beyond react/react-dom; no CSS or style frameworks.

## Standing criteria
- Every new behavior has a test; `pnpm test` and `pnpm typecheck` pass.

## Reviewer checklist
- ARIA roles/attributes match the WAI-ARIA APG pattern; ids generated with useId.
- Controlled and uncontrolled modes both work where documented.
