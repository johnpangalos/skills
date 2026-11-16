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
`expectToMatchFigma`), stop and say so: this plugin's setup skill (`figma-flow:setup`) installs
them. Guessing a mapping is how drift starts.

## The export scripts

They are in this skill's `scripts/` folder, not in the project:

- `lint-node.ts`: what code would have to guess at in those same nodes (values not bound to a
  variable or style, text not linked to its property, detached frames), with a hash as its last
  line.
- `export-node.ts`: the exact values of one or more nodes, with a hash as its last line: size and
  position; fills, strokes (with their align and dash), radius and stroke weight, each a number or
  per side or corner when those differ; rings and shadows with blur; opacity; sizing and min/max;
  auto layout's justify, align and wrap; text type (family, size, weight, line height, letter
  spacing, case, decoration, alignment); and `tokens`, the names of the variables and styles each
  value is bound to. Colours are `#rrggbb`, or `#rrggbbaa` when see-through. A
  component set gives an entry per variant. A frame that isn't a component (a page, or part of
  one) gives an entry for every frame and text under it, including under groups, which get no
  entry of their own. Each library instance gets one entry and isn't opened: the design system
  measures its components. An instance of a component made in the file is opened, since the app
  builds it. Each entry has the node's `id`, and a repeated key is numbered (`ClaimRow (2)`), so
  no entry overwrites another.
- `export-tokens.ts`: the file's own variables, text styles and effect styles. An alias is resolved
  to its value and names what it points at; a collection with several modes gives each mode's
  value; a text style gives its weight, letter spacing (px), case and decoration; an effect style
  gives its shadows and blurs, hidden effects left out. Run it on the file
  that defines them: a library's, for a design built from one. On a file with none of its own it
  throws, naming the library collections the file uses.
- `print.ts`: prints any of them as plain JavaScript for the Figma MCP's `use_figma`. The scripts
  run inside Figma, so they can't be run in Node directly. It also checks saved files (below).

```sh
node <this skill's folder>/scripts/print.ts lint-node <node id> [<node id>…]
node <this skill's folder>/scripts/print.ts export-node <node id> [<node id>…]
node <this skill's folder>/scripts/print.ts export-tokens
```

To keep the printed code in a file, give it a name of its own (`mktemp`), never a fixed name
like `$TMPDIR/lint.js`: the temp folder is shared, so other sessions overwrite and read it.

Pass the printed code to `use_figma` with this as its first line, so the mod writes the result
to the file and nobody retypes it:

```
// figma-flow:save <the project's exports folder>/<name>.json
```

The path is relative to the project, or absolute inside it. The mod refuses any other path and
says so; save that result yourself. Without the mod, save the output exactly as returned, character
for character. An export or a lint ends in a hash of the rest:
`node <this skill's folder>/scripts/print.ts check <file>` exits 1 unless the file matches it. The
token snapshot has no hash of its own: print `export-tokens` with `--hash`, run it, and compare its
`{ length, hash }` with `node <this skill's folder>/scripts/print.ts hash <file>`.

## Flow

1. **Read the design.** With the Figma MCP, get the frame's structure, a screenshot, and the
   variables and styles it uses. List every component instance and find the code component for
   each. List every state the design draws (hover, pressed, focus, disabled).
2. **Lint the nodes** you will export, with the same ids in the same order: run `lint-node` as
   above and save its result where the project keeps lint files (by default
   `<exports folder>/<name>-lint.json`, next to the export). Each finding is something code
   would have to guess at. It is fixed in Figma, by the designer, then linted again; one that is
   right as it is gets accepted where the project keeps accepted findings, with a reason. Don't
   export or build around an open finding.
3. **Stop on gaps, before building.** Open lint findings, a component with no code
   counterpart, a font the project doesn't serve: report these to the person now. Don't fill a
   gap with an arbitrary value. For each lint finding, give what the variants it should match
   have in that layer and field, read from Figma, never guessed. Sort the findings into two
   groups: those that change what is drawn (a value unlike the one those variants get from
   their variable or style), and those that only lose a binding (the same value, with nothing
   bound). The first group are visible mistakes. The second group draw correctly today but
   won't follow the next change to the variable or style. Say that nothing has been measured
   or compared with screenshots yet, so a clean lint won't be the last check.
4. **Export what Figma says**, fresh, every time: run `export-node` on the nodes as above. If
   the task hands you a saved export and no Figma access, use that.
5. **Build.** Resolve every exported value to the project's own name for it first (which token
   a colour is, which utility a size, radius or weight is), then build with the project's
   components and theme utilities only. Render the result on a page the measurement can open.
   The page doesn't have to look like the Figma file: it has to show every variant, with each
   state reachable the way a person reaches it.
6. **Measure.** Add a spec that calls `expectToMatchFigma` for each entry in the export (for a
   page, `expectPageToMatchFigma` with an element for every key, which also checks text and
   each element's position in its parent, and fails on a key with no element; `skip("why")` is
   for an entry that can't be measured, and the report lists it), then
   run the project's measurement and its other checks. Fix the code until they pass. Never
   loosen the comparison, delete a case, or edit an export to make it pass.
7. **Look**, once the measurement passes. Take a screenshot of the Figma node and one of the
   rendered page in the same states and at the same scale. Spawn `figma-flow:looker` with the
   two image paths and a one-line description of the layout, and nothing about what was
   built. If that agent type isn't listed, use a general-purpose agent with the prompt in
   `agents/looker.md`, on the most capable model available.
8. **Act on the looker.** A `likely` finding the measurement didn't catch means the export or
   the test is missing a value: add it, then fix the code. Turn each `unsure` finding into a
   measurement, or say why it can't be measured. Don't argue with a finding from memory: check
   it against the exported values.
9. **Stop after two rounds** of fixing and report: what was built, what the measurement
   covers, what the looker still flags that the measurement can't read, and every gap from
   step 3. Say plainly if a check still fails.

## The mod

The plugin's mod does two things a skill can't:

- **Saves marked Figma results to disk** (the `figma-flow:save` line above).
- **Holds `git commit` and `git push`** once this skill or a Figma tool has been used and a
  source file has changed, until the measurement command passes. It counts edits by subagents
  too. If you are held, run the measurement and fix what it reports. Only the person can lift
  the hold, with `/figma-hold release`; don't ask them to unless the measurement itself is
  broken.

The mod recognises the measurement as a shell command containing `test:figma`, so name the
project's script that, in the `package.json` at its root. A project without that script is never
held, since nothing in it could pass. `/figma-hold` shows what is being held.

## Not for

Designs with no Figma source, restyling by taste, or work where "close" is acceptable: build
those directly. For a change that is mostly behaviour, not appearance, use feature-flow-lite.
