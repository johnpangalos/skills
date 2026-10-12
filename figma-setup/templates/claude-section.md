## Building from Figma

<!-- Written by figma-setup. Edit it like the rest of this file. -->

The design source is <FIGMA FILE NAME AND URL> (file key `<KEY>`). Read it with the Figma MCP.
Figma decides: don't approximate a value, and don't "fix" a design in code. If Figma looks
wrong, say so and leave the code matching Figma.

### How Figma maps to code here

| In Figma | In code |
|---|---|
| <one row per kind of thing this file uses: colour variable, spacing variable, radius, text style, effect style, auto layout, component, component property, state variant, text property> | <the project's own equivalent, with one real example each> |

Components so far:

| Figma component | Node | Code |
|---|---|---|
| <name> | `<node id>` | <import and path> |

Rules:

- <the project's styling rule, e.g. theme utilities only, no arbitrary values>
- A value with no variable in Figma is a question for the designer, not a magic number.
- <the font, and where it is served from, if it has to match Figma's version>

### Building something from Figma

1. **Export the node's values**, fresh, every time you build or change a design:
   `node <SCRIPTS DIR>/print.ts export-node <node id> [<node id>…]` prints a script; run it
   with the Figma MCP's `use_figma` and save the result, exactly as returned, to
   `<EXPORTS DIR>/<name>.json`. It ends in a hash the tests check.
2. **Build it** from the export, following the mapping above.
3. **Render it** on a page the test can open: <where such pages live and their URL pattern>.
   The page doesn't have to look like the Figma file; it has to show every variant, with each
   state reachable the way a person reaches it.
4. **Measure it.** Add a spec in `<TESTS DIR>` that calls `expectToMatchFigma` for each entry
   in the export (copy `<an existing spec>`), then run `<TEST COMMAND>` and fix the code until
   it passes. Never loosen the comparison, delete a case, or edit an export by hand.

What the measurement can't read here: <e.g. shadows with blur, a ring drawn as a separate
shape, positions across text-hugging siblings; or "nothing known yet">.
