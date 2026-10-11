---
name: figma-flow
description: Use when turning a Figma frame or component into React that has to match the design exactly, or when checking existing React against its Figma source. Reads the design through the Figma MCP, builds with the project's own components and tokens, then verifies in two steps: a fresh agent looks at screenshots, and exact values are measured against Figma's.
---

# Figma Flow

Build from Figma, then prove it matches. Figma decides: never approximate a value, and never
"fix" a design in code. If Figma looks wrong, say so and leave the code matching Figma.

The proof has two halves, and both are needed. In a trial with eight planted bugs, an agent
looking at screenshots found seven and described each one, but it also reported differences on
a correct component, so it can't say "done". Measured values caught all eight and passed the
correct one, but only cover what was exported. Look to find problems; measure to finish.

## Before you start

Read the project's instructions (CLAUDE.md or similar) for how Figma maps to code there:
which utility a variable becomes, where components live, how to run the measurement. Follow
them over anything here. If the project has none, stop and say what is missing; guessing a
mapping is how drift starts.

## Flow

1. **Read the design.** With the Figma MCP, get the frame's structure, a screenshot, and the
   variables and styles it uses. List every component instance, and find the code component
   for each. List every state the design draws (hover, pressed, focus, disabled).
2. **Stop on gaps, before building.** A value with no variable, a component with no code
   counterpart, a font the project doesn't serve: report these to the person now. Don't fill
   a gap with an arbitrary value.
3. **Export what Figma says.** Run the project's export script on the node through
   `use_figma`, with this as the script's first line:

   ```
   // figma-flow:save <path the project keeps exports in>/<name>.json
   ```

   The mod writes the result to that file, so don't retype it. Without the mod, save the
   output exactly as returned.
4. **Build.** Use the project's components and theme utilities only. Render the result on a
   page the measurement can open, with each state reachable the way a person reaches it.
5. **Look.** Take a screenshot of the Figma node and one of the rendered page in the same
   states and at the same scale. Spawn `figma-flow:looker` with the two image paths and a
   one-line description of the layout, and nothing about what you built or expect. If that
   agent type isn't listed, use a general-purpose agent with the prompt in
   `agents/looker.md`, on the most capable model available: in a trial a smaller model
   rated a wrong radius and a wrong font weight only `unsure`. Fix every finding it marks
   `likely`, and add a measurement for every `unsure` one. Don't argue with a finding from
   memory: check it against the exported values.
6. **Measure.** Add the nodes to the project's Figma test and run it. Fix the code until it
   passes. Never loosen the comparison, delete a case, or re-export to make it pass.
7. **Loop, at most three rounds** of look and measure. Then stop and report.
8. **Report** what was built, what the measurement covers, what the looker still flags that
   the measurement can't read, and every gap from step 2.

## The mod

The plugin's mod does two things a skill can't:

- **Saves marked Figma results to disk** (step 3).
- **Holds `git commit` and `git push`** once a Figma tool has been used and a source file has
  changed, until the measurement command passes. If you are held, run the measurement and fix
  what it reports. Only the person can lift the hold, with `/figma-flow release`; don't ask
  them to unless the measurement itself is broken.

The mod recognises the measurement as a shell command containing `test:figma`, so name the
project's script that. `/figma-flow` shows what is being held.

## Not for

Designs with no Figma source, restyling by taste, or work where "close" is acceptable: build
those directly.
