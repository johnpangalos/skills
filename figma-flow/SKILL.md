---
name: figma-flow
description: Use when turning a Figma component or frame into React that must match the design exactly, checking existing React against its Figma source, or refreshing a Figma export. Routes to figma-flow:component (a component or component set) or figma-flow:page (a frame built from components); this skill holds the steps both share.
---

# Figma Flow

Figma decides. Never approximate a value, and never "fix" a design in code. If Figma looks
wrong, say so and leave the code matching Figma.

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

## Which skill

Pick by Figma's node type, checked with the Figma MCP's `get_metadata` (the same split
`export-node` makes), and invoke that sub-skill:

- **`figma-flow:component`**: a COMPONENT or COMPONENT_SET, a single INSTANCE (`export-node`
  treats it like a component), or several ids that are parts of one component (Tabs:
  `18:13 18:14 18:23`).
- **`figma-flow:page`**: a FRAME that isn't a component: a page, or a section of one.

A mix of a FRAME and component ids is exported separately, one skill each. Checking existing
React against Figma, and refreshing an export, take the same route.

Each sub-skill has the whole flow. The sections below are shared, and the sub-skills point here
for them.

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
  per side or corner when those differ; rings (spread-only drop shadows) and every other shadow;
  opacity; sizing and min/max; auto layout's justify, align and wrap, each left out where it
  can't show (justify on a box that hugs its direction with no min size on that axis, or where a
  child fills it; align where every child fills or spans the box's content across); text type
  (family, size, weight, line height in px, letter spacing, case, decoration, alignment); and
  `tokens`, the names of the variables and styles each value is bound to (a text style's own font
  is not repeated; a stroke's only where there is a stroke). A shadow with no blur, offset or
  spread draws nothing and is left out. Colours are `#rrggbb`, or `#rrggbbaa` when see-through.
  The file is format 2 (`"format": 2` after `node`): a field at its default (`fill`, `stroke` and
  `label` null, `strokeWeight` and `radius` 0, `opacity` 1, empty `rings` and `shadows`, letter
  spacing 0, case and decoration "none", inside stroke align) is left out, and the reader puts it
  back. Its entries are shaped by what the node is: a component set gives an entry per variant,
  and a frame that isn't a component gives an entry for every frame and text under it. Each entry
  has the node's `id`, and a repeated key is numbered (`ClaimRow (2)`), so no entry overwrites
  another. The sub-skills say what each shape means for building.
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

From a sub-skill, that folder is `<sub-skill folder>/../../scripts/`, not
`<this skill's folder>/scripts/`.

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

## The mod

The plugin's mod does two things a skill can't:

- **Saves marked Figma results to disk** (the `figma-flow:save` line above).
- **Holds `git commit` and `git push`** once one of the figma-flow skills (`figma-flow`,
  `figma-flow:component`, `figma-flow:page`, `figma-flow:setup`) has been invoked, or a Figma tool
  has been used, and a source file has changed, until the measurement command passes. It counts
  edits by subagents too. If you are held, run the measurement and fix what it reports. Only the
  person can lift the hold, with `/figma-hold release`; don't ask them to unless the measurement
  itself is broken.

The mod recognises the measurement as a shell command containing `test:figma`, so name the
project's script that, in the `package.json` at its root. A project without that script is never
held, since nothing in it could pass. `/figma-hold` shows what is being held.

## Not for

Designs with no Figma source, restyling by taste, or work where "close" is acceptable: build
those directly. For a change that is mostly behaviour, not appearance, use feature-flow-lite.
