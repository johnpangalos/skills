---
name: component
description: Use to build or check a Figma component or component set in React: one with variants and states (hover, pressed, focus, disabled), or several export ids that are parts of one component. Pick figma-flow:page instead for a frame or screen built from components.
---

# Figma Flow: component

Builds or checks one Figma component, or component set, in React, against Figma's exact values.

Read the shared sections of figma-flow first, in `<this skill's folder>/../../SKILL.md`: "What
the project provides", "The export scripts" and "The mod". Stop if the project provides no mapping
rules or no measurement. The scripts are in `<this skill's folder>/../../scripts/`.

## Flow

1. **Read the design.** With the Figma MCP, get the component's structure, a screenshot, and the
   variables and styles it uses. List every variant, and every state the design draws (hover,
   pressed, focus, disabled). List every component instance inside it and find the code component
   for each. Check whether the component itself exists in code: if not, that is the normal case,
   and it is built under its Figma name; if it does, it is changed to match Figma.
2. **Lint the nodes** you will export, with the same ids in the same order: run `lint-node` as
   the shared section shows and save its result where the project keeps lint files (by default
   `<exports folder>/<name>-lint.json`, next to the export). Each finding is something code
   would have to guess at. It is fixed in Figma, by the designer, then linted again; one that is
   right as it is gets accepted where the project keeps accepted findings, with a reason. Don't
   export or build around an open finding.
3. **Stop on gaps, before building.** Report these to the person now: open lint findings, a
   library component used inside this one that has no code counterpart (don't build around it),
   and a font the project doesn't serve. Don't fill a gap with an arbitrary value. For each lint
   finding, give what the variants it should match have in that layer and field, read from Figma,
   never guessed. Sort the findings into two groups: those that change what is drawn (a value
   unlike the one those variants get from their variable or style), which are visible mistakes;
   and those that only lose a binding (the same value, with nothing bound), which draw correctly
   today but won't follow the next change to the variable or style. Say that nothing has been
   measured or compared with screenshots yet, so a clean lint won't be the last check.
4. **Export what Figma says**, fresh, every time: run `export-node` on the same ids as the lint.
   If the task hands you a saved export and no Figma access, use that. A component set gives an
   entry per variant, keyed by the variant's name. Several ids give entries keyed
   `<node name>/<variant>` for sets and `<node name>` for the rest. A node that lays out two or
   more children also gets `layout`, and each child an entry keyed `<parent> > <label or name>`
   with its position inside the parent.
5. **Build.** Resolve every exported value to the project's own name for it first (which token
   a colour is, which utility a size, radius or weight is), then build with the project's
   components and theme utilities only. Render the result on a page the measurement can open.
   The page doesn't have to look like the Figma file: it has to show every variant, with each
   state reachable the way a person reaches it.
6. **Measure.** Add a spec that calls `expectToMatchFigma` for each entry in the export
   (`skip("why")` is for an entry that can't be measured, and the report lists it), then run the
   project's measurement and its other checks. Fix the code until they pass. Never loosen the
   comparison, delete a case, or edit an export to make it pass.
7. **Look**, once the measurement passes. Take a screenshot of the Figma node and one of the
   rendered page in the same states and at the same scale. Spawn `figma-flow:looker` with the
   two image paths and a one-line description of the layout, and nothing about what was built.
   If that agent type isn't listed, use the prompt in `<this skill's folder>/../../agents/looker.md`
   instead.
8. **Act on the looker.** A `likely` finding the measurement didn't catch means the export or
   the test is missing a value: add it, then fix the code. Turn each `unsure` finding into a
   measurement, or say why it can't be measured. Don't argue with a finding from memory: check
   it against the exported values.
9. **Stop after two rounds** of fixing and report: what was built, what the measurement
   covers, what the looker still flags that the measurement can't read, and every gap from
   step 3. Say plainly if a check still fails.
