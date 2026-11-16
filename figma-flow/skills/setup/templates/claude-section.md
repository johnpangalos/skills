## Building from Figma

<!-- Written by figma-flow's setup skill. Edit it like the rest of this file. -->

The design source is <FIGMA FILE NAME AND URL> (file key `<KEY>`)<, built from the published
library LIBRARY NAME AND URL (file key `LIBRARY KEY`): only when they differ>. Read them with the
Figma MCP. Figma decides: don't approximate a value, and don't "fix" a design in code. If Figma
looks wrong, say so and leave the code matching Figma.

### How Figma maps to code here

<One sentence on where the design's variables live in code, e.g. "Tailwind v4's theme
(`src/index.css`), so a variable is the utility of the same name" or "`@workers-comp/ui/styles.css`
defines them as CSS custom properties on `:root`, so page CSS uses `var(...)`". Then: "Go by the
variable's WEB code syntax in `<EXPORTS DIR>/tokens.json`, not its name.">

| In Figma | In code |
|---|---|
| <one row per kind of thing this file uses: colour variable, spacing variable, radius, size or container variable, text style, effect style, auto layout, component, component property, state variant, text property> | <the project's own equivalent, with one real example each> |

<Examples of the "In code" column, by styling system. Keep the one that fits, with this repo's names:
- Tailwind: colour `gray/900` → `text-gray-900`, `bg-gray-50`; spacing `spacing/6` → `p-6`, `gap-6`;
  radius `radius/lg` → `rounded-lg`; text style `text-lg/semibold` → `text-lg font-semibold`.
- CSS custom properties (no Tailwind): colour `gray/900` (WEB `var(--color-gray-900)`) →
  `color: var(--color-gray-900)`; spacing `spacing/6` (WEB `calc(var(--spacing) * 6)`) →
  `padding: calc(var(--spacing) * 6)`; radius → `border-radius: var(--radius-lg)`; text style
  `text-lg/semibold` → `font-size: var(--text-lg); line-height: var(--text-lg--line-height);
  font-weight: var(--font-weight-semibold)`.
- An effect style with no variable in code: its layers from tokens.json, written once where the
  project keeps shared CSS, and that place named here.>

Components so far<: when the components come from a library, their nodes are in the library's
file (`LIBRARY KEY`), not this one; a page holds instances of them>:

| Figma component | Node | Code |
|---|---|---|
| <name> | `<node id>` | <import and path> |

No code yet (stop and report when a design uses one; don't build it here): <each library component
with no code counterpart, with its node id; or "none">. <A component made in this file, not the
library, is the app's to build: name each one and where it goes.>

Rules:

- <the project's styling rule, e.g. theme utilities only, no arbitrary values; or the design
  system's CSS variables only, never a raw value>
- A value with no variable in Figma is a question for the designer, not a magic number.
- The font is <FAMILY AND VERSION, the one Figma uses>, served from <WHERE>. A spec waits for it
  (`document.fonts.load`) before measuring text.

### Building something from Figma

1. **Lint, then export the node's values**, fresh, every time you build or change a design. The
   scripts live in the figma-flow plugin, not in this repo: use its figma-flow skill, which runs
   `lint-node` and `export-node` through the Figma MCP's `use_figma`. Save the results, exactly as
   returned, to `<EXPORTS DIR>/<name>-lint.json` and `<EXPORTS DIR>/<name>.json`. Each ends in a
   hash the tests check.
2. **Build it** from the export, following the mapping above.
3. **Render it** on a page the test can open: <where such pages live and their URL pattern>.
   For a component, the page doesn't have to look like the Figma file; it has to show every
   variant, with each state reachable the way a person reaches it.
4. **Measure it.** Add a spec in `<TESTS DIR>`: for a component, `expectToMatchFigma` for each
   entry in the export (copy `<the component spec, or "example.figma.spec.ts from figma-flow's
   setup templates">`); for a page, `expectPageToMatchFigma` with an element or `skip("why")` for
   every key (copy `<the worked example's spec>`). Then run `<TEST COMMAND>` and fix the code until
   it passes. Never loosen the comparison, delete a case, or edit an export by hand.

What the measurement can't read here: <e.g. a vector, or a ring drawn as a separate shape
(a focus ring drawn as a Figma shadow is read), positions across text-hugging siblings; or "nothing
known yet">.
