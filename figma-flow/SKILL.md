---
name: figma-flow
description: Use when turning a Figma frame or component into React that has to match the design exactly, when checking existing React against its Figma source, or when a Figma export needs refreshing. Exports Figma's exact values with the scripts this skill carries, builds with the project's own components and tokens, measures the result against those values, then has a fresh agent look at screenshots for what the values can't describe.
---

# Figma Flow

Export, build, measure, look. Figma decides: never approximate a value, and never "fix" a
design in code. If Figma looks wrong, say so and leave the code matching Figma.

The measurement is what makes this work. In trials, a model with nothing but Figma's exact
values in a file and a test that reports each expected and rendered value built a Button and
a set of Tabs correctly in about a minute, on Sonnet as well as Opus. Handing the build to a
pipeline of subagents reached the same result at several times the cost, so this skill builds
directly. Haiku on its own failed every run and reported success: use Sonnet or Opus.

Measuring and looking do different jobs, and both are needed. In a trial with eight planted
bugs, measured values caught all eight and passed a correct component, but they only cover
what was exported. An agent looking at screenshots found most of the bugs and described each
one, but it also reported differences on a correct component, so it can't say "done". Measure
to finish; look to find what the measurement can't read.

## What the project provides

Read the project's instructions first (the "Building from Figma" section of CLAUDE.md, or a
`## Figma` section in FEATURE_FLOW.md). They say how Figma maps to code here, where exports
are kept, and how to measure. Follow them over anything here.

If the project has no mapping rules or no measurement (a `test:figma` command with
`expectToMatchFigma`), stop and say so: the figma-setup skill installs them. Guessing a
mapping is how drift starts.

## The export scripts

They are in this skill's `scripts/` folder, not in the project:

- `export-node.ts`: the exact values of one or more nodes, with a hash as its last line.
- `export-tokens.ts`: the file's variables, text styles and effect styles.
- `print.ts`: prints either as plain JavaScript for the Figma MCP's `use_figma`. The scripts
  run inside Figma, so they can't be run in Node directly.

```sh
node <this skill's folder>/scripts/print.ts export-node <node id> [<node id>…]
node <this skill's folder>/scripts/print.ts export-tokens
```

Pass the printed code to `use_figma` with this as its first line, so the mod writes the result
to the file and nobody retypes it:

```
// figma-flow:save <the project's exports folder>/<name>.json
```

Without the mod, save the output exactly as returned. To check a saved file against Figma
without reading it back, print the script with `--hash` and compare its `{ length, hash }`
with `node <this skill's folder>/scripts/print.ts hash <file>`.

## Flow

1. **Read the design.** With the Figma MCP, get the frame's structure, a screenshot, and the
   variables and styles it uses. List every component instance and find the code component for
   each. List every state the design draws (hover, pressed, focus, disabled).
2. **Stop on gaps, before building.** A value with no variable, a component with no code
   counterpart, a font the project doesn't serve: report these to the person now. Don't fill a
   gap with an arbitrary value.
3. **Export what Figma says**, fresh, every time: run `export-node` on the nodes as above. If
   the task hands you a saved export and no Figma access, use that.
4. **Build.** Resolve every exported value to the project's own name for it first (which token
   a colour is, which utility a size, radius or weight is), then build with the project's
   components and theme utilities only. Render the result on a page the measurement can open.
   The page doesn't have to look like the Figma file: it has to show every variant, with each
   state reachable the way a person reaches it.
5. **Measure.** Add a spec that calls `expectToMatchFigma` for each entry in the export, then
   run the project's measurement and its other checks. Fix the code until they pass. Never
   loosen the comparison, delete a case, or edit an export to make it pass.
6. **Look**, once the measurement passes. Take a screenshot of the Figma node and one of the
   rendered page in the same states and at the same scale. Spawn `figma-flow:looker` with the
   two image paths and a one-line description of the layout, and nothing about what was
   built. If that agent type isn't listed, use a general-purpose agent with the prompt in
   `agents/looker.md`, on the most capable model available.
7. **Act on the looker.** A `likely` finding the measurement didn't catch means the export or
   the test is missing a value: add it, then fix the code. Turn each `unsure` finding into a
   measurement, or say why it can't be measured. Don't argue with a finding from memory: check
   it against the exported values.
8. **Stop after two rounds** of fixing and report: what was built, what the measurement
   covers, what the looker still flags that the measurement can't read, and every gap from
   step 2. Say plainly if a check still fails.

## The mod

The plugin's mod does two things a skill can't:

- **Saves marked Figma results to disk** (the `figma-flow:save` line above).
- **Holds `git commit` and `git push`** once this skill or a Figma tool has been used and a
  source file has changed, until the measurement command passes. It counts edits by subagents
  too. If you are held, run the measurement and fix what it reports. Only the person can lift
  the hold, with `/figma-flow release`; don't ask them to unless the measurement itself is
  broken.

The mod recognises the measurement as a shell command containing `test:figma`, so name the
project's script that. `/figma-flow` shows what is being held.

## Not for

Designs with no Figma source, restyling by taste, or work where "close" is acceptable: build
those directly. For a change that is mostly behaviour, not appearance, use feature-flow-lite.
