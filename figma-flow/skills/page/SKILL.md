---
name: page
description: Use to build or check a Figma frame or screen in React: a FRAME that isn't a component (a page, or a section of one), built from the design system's components. Pick figma-flow:component for a component or component set. An instance of a library component is used as it is and measured by the design system; an instance of a component made in the file is opened and built as part of the page.
---

# Figma Flow: page

Builds or checks one Figma frame, a page or a section of one, in React, against Figma's exact
values.

Read the shared sections of figma-flow first, in `<this skill's folder>/../../SKILL.md`: "What
the project provides", "The export scripts" and "The mod". Stop if the project provides no mapping
rules or no measurement. The scripts are in `<this skill's folder>/../../scripts/`.

## Flow

1. **Read the design.** With the Figma MCP, get the frame's structure, a screenshot, and the
   variables and styles it uses. List every component instance in it, and whether each is a
   library component or a component made in this file. Find the code component for each library
   instance. List every state the design draws (hover, pressed, focus, disabled).
2. **Lint the nodes** you will export, with the same ids in the same order: run `lint-node` as
   the shared section shows and save its result where the project keeps lint files (by default
   `<exports folder>/<name>-lint.json`, next to the export). Each finding is something code
   would have to guess at. It is fixed in Figma, by the designer, then linted again; one that is
   right as it is gets accepted where the project keeps accepted findings, with a reason. Don't
   export or build around an open finding.
3. **Stop on gaps, before building.** Report these to the person now: open lint findings, a font
   the project doesn't serve, and a library instance with no code counterpart. That instance is
   not built, so stop and report it. Don't fill a gap with an arbitrary value. For each lint
   finding, give what it should match, read from Figma, never guessed. Sort the findings into two
   groups: those that change what is drawn (a value unlike the one that layer should get from its
   variable or style), which are visible mistakes; and those that only lose a binding (the same
   value, with nothing bound), which draw correctly today but won't follow the next change to the
   variable or style. Say that nothing has been measured or compared with screenshots yet, so a
   clean lint won't be the last check.
4. **Export what Figma says**, fresh, every time: run `export-node` on the same ids as the lint.
   If the task hands you a saved export and no Figma access, use that. A frame that isn't a
   component gives an entry for every frame and text under it, including under groups, which get
   no entry of their own. Each library instance gets one entry, its box, and isn't opened: the
   design system measures its components. An instance of a component made in this file is opened,
   since the app builds it, so its frames and text get entries too.
5. **Build.** Resolve every exported value to the project's own name for it first (which token
   a colour is, which utility a size, radius or weight is), then build with the project's
   components and theme utilities only. Render the result on a page the measurement can open.
   The page doesn't have to look like the Figma file: it has to have an element for every key of
   the export, so the measurement can read each one. An instance of a component made in this file
   is built as part of the page, from the same project components and utilities.
6. **Measure.** Add a spec that calls `expectPageToMatchFigma` with an element for every key of
   the export. It also checks each element's text and its position in its parent, and it fails on
   a key with no element. `skip("why")` is for an entry that can't be measured, and the report
   lists it. Then run the project's measurement and its other checks. Fix the code until they
   pass. Never loosen the comparison, delete a case, or edit an export to make it pass.
7. **Look**, once the measurement passes. Take a screenshot of the Figma node and one of the
   rendered page in the same states and at the same scale. Spawn `figma-flow:looker` with the
   two image paths and a one-line description of the layout, and nothing about what was built.
   If that agent type isn't listed, use a general-purpose agent with the prompt in
   `<this skill's folder>/../../agents/looker.md`, on the most capable model available.
8. **Act on the looker.** A `likely` finding the measurement didn't catch means the export or
   the test is missing a value: add it, then fix the code. Turn each `unsure` finding into a
   measurement, or say why it can't be measured. Don't argue with a finding from memory: check
   it against the exported values.
9. **Stop after two rounds** of fixing and report: what was built, what the measurement
   covers, what the looker still flags that the measurement can't read, and every gap from
   step 3. Say plainly if a check still fails.
