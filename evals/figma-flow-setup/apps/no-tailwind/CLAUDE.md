## Building from Figma

<!-- Written by figma-flow's setup skill. Edit it like the rest of this file. -->

The design source is "Workers Comp Pages (eval)" (https://www.figma.com/design/0Uld8qYjwyl7HJLEMwqxNv, file key `0Uld8qYjwyl7HJLEMwqxNv`), built from the published
library "Workers Comp Design System" (https://www.figma.com/design/5OcRRw5a7qZGsgC43FjCp9, file key `5OcRRw5a7qZGsgC43FjCp9`), which `@workers-comp/ui` implements. Read them with the
Figma MCP. Figma decides: don't approximate a value, and don't "fix" a design in code. If Figma
looks wrong, say so and leave the code matching Figma.

### How Figma maps to code here

`@workers-comp/ui/styles.css` (imported in `src/main.tsx`) defines the design's variables as CSS custom
properties on `:root`, so page CSS uses `var(...)`. There is no Tailwind in this app. Go by the
variable's WEB code syntax in `figma/tokens.json`, not its name.

| In Figma | In code |
|---|---|
| Colour variable `gray/900` (WEB `var(--color-gray-900)`) | `color: var(--color-gray-900)`; `background: var(--color-gray-50)` |
| Spacing variable `spacing/6` (WEB `calc(var(--spacing) * 6)`) | `padding: calc(var(--spacing) * 6)`; `gap: calc(var(--spacing) * 3)` |
| Radius variable `radius/lg` (WEB `var(--radius-lg)`) | `border-radius: var(--radius-lg)` |
| Container variable `container/md` (448, WEB `var(--container-md)`) | `width: var(--container-md)` |
| Text style `text-lg/semibold` | `font-size: var(--text-lg); line-height: var(--text-lg--line-height); font-weight: var(--font-weight-semibold)` |
| Effect style `shadow-md` | no variable in code: its layers are in `figma/tokens.json` (`effectStyles`); none is used by the worked example yet. Write it once in the page CSS that needs it and name that place here. |
| Auto layout (`layout.direction`, `gap`, `padding`, alignment) | `display: flex; flex-direction: row|column; gap; padding`. Figma's default alignment is start, so say `align-items: flex-start`; a child set to fill is `width: 100%` on the element itself. See `src/pages/report-an-injury.css` |
| Library component instance (`TextField`) | `import { TextField } from "@workers-comp/ui"`, e.g. `<TextField label="Date of injury" .../>` |
| Component property (variant `invalid=true`, `state=disabled`) | the prop of the same name: `<Select invalid>`, `<TextField disabled>`, `<Button variant="outline">` |
| State variant (hover, pressed, focus) | not a prop: the library reports it as `data-hovered`, `data-pressed`, `data-focus-visible`, `data-disabled`; don't set it by hand |
| Text property (`label`, `description`, `placeholder`, `errorMessage`) | the prop of the same name: `<TextArea label="What happened" description="..." placeholder="..."/>`. Read the instances' `componentProperties` with a read-only `use_figma` call; the export doesn't have them. Build what the frame draws (a placeholder shown beats a `value` set) |

Components so far: they come from the library, so their nodes are in the library's file
(`5OcRRw5a7qZGsgC43FjCp9`), not the design file; a page holds instances of them:

| Figma component | Node | Code |
|---|---|---|
| Button | `1:91` | `import { Button } from "@workers-comp/ui"` |
| Badge | `36:112` | `import { Badge } from "@workers-comp/ui"` |
| Chip | `39:15` | `import { Chip } from "@workers-comp/ui"` |
| Tabs, TabList, Tab (set), TabPanel | `18:23`, `18:14`, `18:13`, `18:21` | `import { Tabs, TabList, Tab, TabPanel } from "@workers-comp/ui"` |
| TextField | `98:232` | `import { TextField } from "@workers-comp/ui"` |
| TextArea | `98:133` | `import { TextArea } from "@workers-comp/ui"` |
| Select, SelectTrigger, SelectOption | `100:79`, `100:43`, `100:52` | `import { Select, SelectOption } from "@workers-comp/ui"` (the trigger is part of Select) |

No code yet (stop and report when a design uses one; don't build it here): Alert `98:250`, Card
`98:321` (with CardHeader `98:258`, CardTitle `98:252`, CardDescription `98:254`, CardContent
`98:256`, CardFooter `98:263`), Checkbox `98:320`, CheckboxGroup `98:334`, Radio `98:83`,
RadioGroup `98:134`, Switch `98:49`, Listbox `100:53` (only inside Select). The worked example's
"Card" is a plain frame in the design file, not an instance of the library's Card, so it is page CSS.

Rules:

- The design system's CSS variables only, never a raw value. A library component's own width
  (`TextField` is `w-80`) is overridden with `className`, e.g. `width: 100%`.
- A value with no variable in Figma is a question for the designer, not a magic number.
- The font is Inter 3.19 (the version Figma uses), served from the `inter-ui` package at 3.19.3 via
  `src/fonts.css`. A spec waits for it (`document.fonts.load`) before measuring text.

### Building something from Figma

1. **Lint, then export the node's values**, fresh, every time you build or change a design. The
   scripts live in the figma-flow plugin, not in this repo: use its figma-flow skill, which runs
   `lint-node` and `export-node` through the Figma MCP's `use_figma`. Save the results, exactly as
   returned, to `figma/<name>-lint.json` and `figma/<name>.json`. Each ends in a
   hash the tests check.
2. **Build it** from the export, following the mapping above.
3. **Render it** on a page the test can open: every `src/pages/<name>.tsx` is a page at `/<name>`
   (see `src/main.tsx`). For a component, the page doesn't have to look like the Figma file; it
   has to show every variant, with each state reachable the way a person reaches it.
4. **Measure it.** Add a spec in `tests/`: for a component, `expectToMatchFigma` for each
   entry in the export (copy example.figma.spec.ts from figma-flow's setup templates); for a page,
   `expectPageToMatchFigma` with an element or `skip("why")` for
   every key (copy `tests/report-an-injury.figma.spec.ts`). Then run `pnpm test:figma` and fix the code until
   it passes. Never loosen the comparison, delete a case, or edit an export by hand.

What the measurement can't read here: shadows (blur), text colours inside library components,
and anything the export doesn't record (hover, focus and pressed looks, the Select's open listbox).
