## Building from Figma

<!-- Written by figma-flow's setup skill. Edit it like the rest of this file. -->

The design source is Workers Comp Pages (eval)
(https://www.figma.com/design/0Uld8qYjwyl7HJLEMwqxNv, file key `0Uld8qYjwyl7HJLEMwqxNv`), built from the
published library Workers Comp Design System (https://www.figma.com/design/5OcRRw5a7qZGsgC43FjCp9, file
key `5OcRRw5a7qZGsgC43FjCp9`), which `@workers-comp/ui` on npm implements. Read them with the
Figma MCP. Figma decides: don't approximate a value, and don't "fix" a design in code. If Figma
looks wrong, say so and leave the code matching Figma.

### How Figma maps to code here

The library's variables are Tailwind v4's default theme names: `@workers-comp/ui/styles.css` defines
them as CSS custom properties on `:root` (`--color-gray-900`, `--spacing`, `--radius-lg`,
`--text-sm`), and the app's Tailwind v4 (`@import "tailwindcss"` in `src/index.css`) has the same
theme, so a variable is the utility of the same name. Go by the variable's WEB code syntax in
`figma/tokens.json`, not its name.

| In Figma | In code |
|---|---|
| Colour variable (`Colors`) | `gray/900` → `text-gray-900`; `gray/50` → `bg-gray-50`; `gray/400` → `border-gray-400`; `fuchsia/700` → `bg-fuchsia-700` |
| Spacing variable (`Spacing`) | `spacing/6` → `p-6`, `gap-6`; `spacing/1_5` → `gap-1.5`; `spacing/12` → `p-12` |
| Radius variable | `radius/lg` → `rounded-lg`; `radius/md` → `rounded-md` |
| Size / container variable (`Container`) | `container/md` (448) → `w-md` |
| Text style | `text-lg/semibold` → `text-lg font-semibold` (the size's line height comes with `text-lg`); `text-sm/normal` → `text-sm` |
| Effect style | `shadow-md` → `shadow-md` (Tailwind's own shadows, same names) |
| Auto layout | direction, gap, padding → `flex flex-col` / `flex-row`, `gap-*`, `p-*`; primary-axis alignment → `justify-*`; counter-axis alignment → `items-*`. Figma doesn't stretch a child unless it fills, CSS flex does: give every flex container `items-start` unless Figma has the child fill, and state `w-full` on the element that fills its parent |
| Fill container / fixed size | fill the parent's width → `w-full` on the element itself (a library component sets its own `w-80`; a `className` of `w-full` overrides it); fixed → the container or spacing utility (`w-md`) |
| Component (library instance) | the `@workers-comp/ui` component of the same name: `import { Button } from "@workers-comp/ui"` |
| Component property (variant) | the prop of the same name and value: `variant=outline, size=default` → `<Button variant="outline" size="default">`; `invalid=true` → `invalid` |
| Text property (label, description, placeholder, errorMessage) | the prop of the same name: `<TextField label="Date of injury" description="…" placeholder="YYYY-MM-DD" />`; a Button's `Label` is its children |
| State variant (`state=hover`, `focus`, `disabled`) | not set in code: hover and focus come from the user. `state=disabled` → `disabled` |

Components so far (their nodes are in the library's file, `5OcRRw5a7qZGsgC43FjCp9`, not the design
file; a page holds instances of them):

| Figma component | Node | Code |
|---|---|---|
| Button | `1:91` | `Button` from `@workers-comp/ui` |
| Tab | `18:13` | `Tab` |
| TabList | `18:14` | `TabList` |
| TabPanel | `18:21` | `TabPanel` |
| Tabs | `18:23` | `Tabs` |
| Badge | `36:112` | `Badge` |
| Chip | `39:15` | `Chip` |
| TextArea | `98:133` | `TextArea` |
| TextField | `98:232` | `TextField` |
| SelectTrigger | `100:43` | part of `Select` (not exported on its own) |
| SelectOption | `100:52` | `SelectOption`, or `items` on `Select` |
| Select | `100:79` | `Select` |

No code yet (stop and report when a design uses one; don't build it here): Checkbox `98:320`,
CheckboxGroup `98:334`, Switch `98:49`, Radio `98:83`, RadioGroup `98:134`, Alert `98:250`, Card
`98:321` (with CardTitle `98:252`, CardDescription `98:254`, CardContent `98:256`, CardHeader
`98:258`, CardFooter `98:263`), Listbox `100:53`. (Listbox is part of `Select`.)

Rules:

- Tailwind theme utilities only, no arbitrary values (`w-[…]`, `text-[#…]`). The library's own
  styling stays in the library.
- A value with no variable in Figma is a question for the designer, not a magic number.
- The font is Inter 3.19 (the version Figma uses), served from the `inter-ui` package at 3.19.3
  through `src/fonts.css`. A spec waits for it (`document.fonts.load`) before measuring text.

### Building something from Figma

1. **Lint, then export the node's values**, fresh, every time you build or change a design. The
   scripts live in the figma-flow plugin, not in this repo: use its figma-flow skill, which runs
   `lint-node` and `export-node` through the Figma MCP's `use_figma`. Save the results, exactly as
   returned, to `figma/<name>-lint.json` and `figma/<name>.json`. Each ends in a
   hash the tests check.
2. **Build it** from the export, following the mapping above.
3. **Render it** on a page the test can open: a file in `src/pages/` is a page at `/<file name>`
   (`src/pages/report-an-injury.tsx` is `/report-an-injury`).
   For a component, the page doesn't have to look like the Figma file; it has to show every
   variant, with each state reachable the way a person reaches it.
4. **Measure it.** Add a spec in `tests/`: for a component, `expectToMatchFigma` for each
   entry in the export (copy `example.figma.spec.ts` from figma-flow's setup templates); for a
   page, `expectPageToMatchFigma` with an element or `skip("why")` for every key (copy
   `tests/report-an-injury.figma.spec.ts`). Then run `pnpm test:figma` (on a machine whose
   Playwright Chromium isn't installed: `PW_CHROMIUM=<path to chromium> pnpm test:figma`) and fix
   the code until it passes. Never loosen the comparison, delete a case, or edit an export by hand.

What the measurement can't read here: nothing known yet.
