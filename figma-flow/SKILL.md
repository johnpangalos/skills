---
name: figma-flow
description: Use when turning a Figma frame or component into React that has to match the design exactly, or when checking existing React against its Figma source. Reads the design, turns Figma's exact values into acceptance criteria, hands the build to feature-flow-lite's Haiku implementor, then verifies in two steps: a fresh agent looks at screenshots, and exact values are measured against Figma's.
---

# Figma Flow

A front end to feature-flow-lite for work that starts from a Figma design. This skill does the
parts that are about Figma: reading the design, exporting its values, and looking at the
result. feature-flow-lite does the rest: its implementor builds, its checks and fix loop run
as usual. Figma decides: never approximate a value, and never "fix" a design in code. If Figma
looks wrong, say so and leave the code matching Figma.

Why it splits this way: an export of Figma's values is a list of exact, testable facts, which
is what a cheap implementor needs to do well. Reading a design and judging a picture are not,
so those stay with the main conversation and the looker.

The proof has two halves, and both are needed. In a trial with eight planted bugs, an agent
looking at screenshots found most of them and described each one, but it also reported
differences on a correct component, so it can't say "done". Measured values caught all eight
and passed the correct one, but only cover what was exported. Look to find problems; measure
to finish.

## Project file

feature-flow-lite keeps what holds for one repo in `FEATURE_FLOW.md` at the repo root, and
writes it on its first run. figma-flow keeps its part in the same file, under `## Figma`:
where the design is, where the mapping rules are, how to export a node, how to measure, how
to render a page, and what can't be measured here.

Read the file before step 1. If it has no `## Figma` section, write one from
`templates/figma-section.md` in this skill's folder, filled in from the repo (its CLAUDE.md,
package scripts, and any existing export or Figma test), and add the lines the template names
to Checks, Standing criteria and Reviewer checklist. If `FEATURE_FLOW.md` doesn't exist yet,
let feature-flow-lite write it first, as its skill says, then add the section. Don't stop to
ask about it; say in the report that you wrote it.

If the repo has no mapping rules, no export script or no measurement, say which is missing
and stop: guessing a mapping is how drift starts. When a run teaches something the section
should have said (a value the export can't read, a state that needs a special step), add a
line and name it in the report. Never remove a line the person wrote.

## Flow

1. **Read the design.** With the Figma MCP, get the frame's structure, a screenshot, and the
   variables and styles it uses. List every component instance and find the code component for
   each. List every state the design draws (hover, pressed, focus, disabled). If the project
   already holds a saved export of the node, read that instead.
2. **Stop on gaps, before building.** A value with no variable, a component with no code
   counterpart, a font the project doesn't serve: report these to the person now. Don't fill a
   gap with an arbitrary value.
3. **Export what Figma says**, unless it is already saved. Run the project's export script on
   the node through `use_figma`, with this as the script's first line:

   ```
   // figma-flow:save <path the project keeps exports in>/<name>.json
   ```

   The mod writes the result to that file, so don't retype it. Without the mod, save the
   output exactly as returned.
4. **Write the acceptance criteria from the export.** This is feature-flow-lite's step 1, and
   it is where your judgment goes. The project file's standing criteria go in as usual. Resolve every exported value to the project's own name for
   it before handing off: which token a colour is, which utility a size, radius or weight is.
   Then write criteria the implementor can act on without opening Figma or guessing:
   - one line per group of nodes that share values ("default variant, default size: fill
     fuchsia-700, text white, radius md, label 14px/20px semibold, 16px side padding"), with
     what changes in each state;
   - the project's rules as criteria (theme utilities only, existing components, prop names);
   - how each state is reached on the page, since the measurement drives real hover, press and
     focus;
   - the path of the export, as the source of truth where a criterion and the file disagree.
5. **Build.** For one small component, build it yourself to the criteria: in a trial on a
   single Button, plain Opus matched all 30 variants in about a minute for $0.50, and the
   handoff reached the same result at about 2.6 times the cost and 7 times the duration. For
   a page, several components, or anything with behaviour to review, hand off: invoke the
   `feature-flow-lite` skill and follow its flow
   from the implementor step, with your criteria as its `ACCEPTANCE CRITERIA` and these
   `CHECKS`: the project file's Measure command as the targeted command while working, and
   its full checks for the end. If feature-flow-lite isn't installed, build it yourself to
   the same criteria.

   Before the first spawn, say in one line which stages will run (implementor, measurement,
   looker, and a reviewer if there is behaviour to review).

   Once you have handed off, every change to source goes through the implementor, however
   small: a one-class fix after the looker is a fix round, not something to patch yourself.
   You write only the project file, the export and the Figma test. The mod notes it when you
   edit source after a handoff.
6. **Measure.** Run the measurement and the full checks yourself. A failure goes back to the
   implementor with the failing lines, as a fix round. Never loosen the comparison, delete a
   case, or re-export to make it pass.
7. **Look**, once the measurement passes. Take a screenshot of the Figma node (or use the
   saved one) and one of the rendered page in the same states and at the same scale. Spawn
   `figma-flow:looker` with the two image paths and a one-line description of the layout, and
   nothing about what was built. If that agent type isn't listed, use a general-purpose agent
   with the prompt in `agents/looker.md`, on the most capable model available. This is the
   review step for a design; feature-flow-lite's reviewer is for behaviour the design implies
   (keyboard, disabled, props) and runs when there is some.
8. **Act on the looker.** A `likely` finding the measurement didn't catch means the export or
   the test is missing a value: add it, then send the fix to the implementor. Turn each
   `unsure` finding into a measurement, or say why it can't be measured. Don't argue with a
   finding from memory: check it against the exported values.
9. **Stop after feature-flow-lite's two fix rounds** and report: what was built, what the
   measurement covers, what the looker still flags that the measurement can't read, every gap
   from step 2, and which agents ran.

## The mod

The plugin's mod does two things a skill can't:

- **Saves marked Figma results to disk** (step 3).
- **Holds `git commit` and `git push`** once this skill or a Figma tool has been used and a
  source file has changed, until the measurement command passes. It counts edits by subagents too. If you are
  held, run the measurement and fix what it reports. Only the person can lift the hold, with
  `/figma-flow release`; don't ask them to unless the measurement itself is broken.

The mod recognises the measurement as a shell command containing `test:figma`, so name the
project's script that. `/figma-flow` shows what is being held.

It also adds a note when the main conversation edits source after handing the build to an
implementor. It doesn't refuse the edit.

## Not for

Designs with no Figma source, restyling by taste, or work where "close" is acceptable: build
those directly, or with feature-flow-lite alone.
