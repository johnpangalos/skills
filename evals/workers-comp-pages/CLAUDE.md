## Building from Figma

<!-- Written by figma-setup. Edit it like the rest of this file. -->

The design source is [Workers Comp Pages (eval)](https://www.figma.com/design/0Uld8qYjwyl7HJLEMwqxNv)
(file key `0Uld8qYjwyl7HJLEMwqxNv`), built from the published library
[Workers Comp Design System](https://www.figma.com/design/5OcRRw5a7qZGsgC43FjCp9) (file key
`5OcRRw5a7qZGsgC43FjCp9`). Read them with the Figma MCP. Figma decides: don't approximate a value,
and don't "fix" a design in code. If Figma looks wrong, say so and leave the code matching Figma.

### How Figma maps to code here

This app has no Tailwind and no theme of its own. `@workers-comp/ui/styles.css` (imported in
`src/main.tsx`) defines the design system's variables as CSS custom properties on `:root`, so a
page's own CSS uses them. Go by the variable's WEB code syntax in `figma/tokens.json`, not its name.

| In Figma | In code |
|---|---|
| Colour variable `gray/900` (WEB `var(--color-gray-900)`) | `color: var(--color-gray-900)`, `background: var(--color-gray-50)` |
| Spacing variable `spacing/6` (WEB `calc(var(--spacing) * 6)`) | `padding: calc(var(--spacing) * 6)`, `gap: calc(var(--spacing) * 1)`; `spacing/px` is `1px` |
| Radius `radius/lg` (WEB `var(--radius-lg)`) | `border-radius: var(--radius-lg)` |
| Container / Breakpoint `container/md` (WEB `var(--container-md)`) | `width: var(--container-md)`; `breakpoint/xl` is `var(--breakpoint-xl)` |
| Text style `text-lg/semibold` | `font-size: var(--text-lg); line-height: var(--text-lg--line-height); font-weight: var(--font-weight-semibold)`; family `var(--font-sans)` |
| Effect style `shadow-sm` | No variable ships for it: write its layers from `figma/tokens.json` (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`) |
| Auto layout | Flexbox: `flex-direction`, `gap`, `padding`, alignment; hug is the default, fill is `flex: 1` or `width: 100%`, fixed is a width variable |
| Component | The component of the same name from `@workers-comp/ui`. Never rebuild its markup. |
| Component property `variant=outline` | The prop of the same name and value: `<Button variant="outline">` |
| `invalid=true` | `invalid` prop |
| `state=disabled` | `disabled` prop |
| `state` hover / active / focus / pressed | Not a prop: comp0's `data-hovered`, `data-pressed`, `data-focus-visible` |
| Text property (`label`, `description`, `errorMessage`, `placeholder`, `Label`) | The prop of the same name; `Label` is `children` |

Components so far (nodes are in the design system file `5OcRRw5a7qZGsgC43FjCp9`; on a page they
are instances of these):

| Figma component | Node | Code |
|---|---|---|
| Button | `1:91` | `Button` from `@workers-comp/ui` |
| Badge | `36:112` | `Badge` |
| Chip | `39:15` | `Chip` |
| Select | `100:79` | `Select`, `SelectOption` |
| Tabs | `18:23` | `Tabs`, `TabList`, `Tab`, `TabPanel` (Figma's `Tab` is `18:13`, TabList `18:14`, TabPanel `18:21`) |
| TextField | `98:232` | `TextField` |
| TextArea | `98:133` | `TextArea` |

No code yet in `@workers-comp/ui` (stop and report; don't build them here): Checkbox `98:320`,
CheckboxGroup `98:334`, Switch `98:49`, RadioGroup `98:134`, Alert `98:250`, Card `98:321`.
`ClaimRow` (`4:187`) is local to the pages file, so the app builds it.

Rules:

- Use the design system's CSS variables, never a raw value (`24px`, `#a800b7`). A value with no
  variable in Figma is a question for the designer, not a magic number.
- Page CSS and components live in `src/pages/`; a page is `src/pages/<name>.tsx`, shown at `/<name>`.
- Behaviour comes from `@workers-comp/ui` (comp0 inside it). Don't add another component library.
- The font is Inter 3.19, the version Figma uses. Nothing in this app serves it yet (see the
  setup report); don't switch to Google Fonts' Inter.

### Building something from Figma

1. **Lint, then export the node's values**, fresh, every time you build or change a design. The
   scripts live in the figma-flow skill, not in this repo: use that skill, which runs `lint-node`
   and `export-node` through the Figma MCP's `use_figma`. Save the results, exactly as returned,
   to `figma/<name>-lint.json` and `figma/<name>.json`. Each ends in a hash the tests check.
2. **Build it** from the export, following the mapping above.
3. **Render it** on a page the test can open: `src/pages/<name>.tsx`, at
   `http://localhost:5174/<name>`. The page doesn't have to look like the Figma file; it has to
   show every variant, with each state reachable the way a person reaches it.
4. **Measure it.** Add `tests/<name>.figma.spec.ts` that calls `expectToMatchFigma` for each entry
   in the export (copy `tests/example.figma.spec.ts` once it exists), then run `pnpm test:figma`
   and fix the code until it passes. Never loosen the comparison, delete a case, or edit an
   export by hand.

What the measurement can't read here: the export covers a node and its direct children only (a
page nests deeper, so the page frame alone exports as one entry), and skips text children, so
headings and paragraphs go unmeasured; shadows with blur; a ring drawn as a separate shape.
