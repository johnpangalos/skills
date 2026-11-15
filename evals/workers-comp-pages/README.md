# Eval: figma-setup and figma-flow on pages of a consumer app

Do figma-setup and figma-flow hold up outside the design system's own repo, on pages rather
than single components?

- **Design system**: [Workers Comp Design System](https://www.figma.com/design/5OcRRw5a7qZGsgC43FjCp9)
  in Figma, `@workers-comp/ui` on npm.
- **Pages file**: [Workers Comp Pages (eval)](https://www.figma.com/design/0Uld8qYjwyl7HJLEMwqxNv),
  a new file designed the way a product designer would: instances of the design system's
  components, its variables and its text and effect styles, with auto layout.
- **This app**: Vite and React, with `@workers-comp/ui` installed from npm. It has no workspace
  link to workers_comp and no access to its theme or its tests. Every file in `src/pages/` is a
  page at `/<file name>` (`pnpm dev`, port 5174).

## Pages

| Page | Components | What it tests |
|---|---|---|
| Report an injury | TextField, TextArea, Select, Button | Deep form nesting, error and disabled fields |
| Claims inbox | Tabs, Badge, Chip, Button | Lists, a row that wraps, closed TabPanels |
| Claim summary | Badge, Button, text blocks | Pages that are mostly text, `justify-between` rows |
| Trap | A copy of one page with planted mistakes | The lint stops on each one |

## Steps

1. Design the pages in the pages file.
2. Run figma-setup on this app as it is now (an empty Vite app).
3. Run figma-flow on each page from a fresh context, on Sonnet and on Opus, without patching
   either skill mid-run.
4. Record, per page: lint findings and how they were handled, whether the export covered every
   node on screen, the first `test:figma` result, fix rounds, what the looker caught that the
   measurement didn't, and cost and time.

## Expected gaps, checked in the results

- The export covers a node and its direct children only; a page nests deeper.
- Text children are skipped by the export, so headings and paragraphs go unmeasured.
- A fixed page or card width fails the lint unless it is bound to a variable (the file has a
  Container collection, `container/md` and so on, which a designer may not think to use).
- The package ships compiled CSS, not its theme, so the app rebuilds a theme from Figma's
  variables for its own layout.
- Inter has to be 3.19, the version Figma uses.

## Results

### 1. Designing the pages

- **Blocked: the design system isn't published as a Figma library.** The pages file lists the
  team library, but `search_design_system` finds none of its components, variables or styles,
  and `importComponentSetByKeyAsync` / `importStyleByKeyAsync` with the design system's keys
  answer "not found". A designer can't use the primitives from another file until the design
  system file is published (Assets, Publish library), which only a person can do in the Figma
  app. Neither skill says so: figma-setup reads the design system file, and figma-flow reads
  whichever file it's handed, so nothing checks that a consumer's file links to the library
  instead of copying from it.

- **Unblocked by publishing the library** (by hand, in the Figma app; the plugin API has no
  publish call and the iOS app can't publish either). After that, components, text and effect
  styles and all variable collections imported by key, and `search_design_system` found them.
  `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` still returned nothing, so
  variables were reached through `search_design_system` and `importVariableByKeyAsync`.
- **Pages designed** (file `0Uld8qYjwyl7HJLEMwqxNv`), all from library instances, variables bound
  for every fill, padding, gap, radius and fixed width (`breakpoint/xl` for the page,
  `container/*` for the column), text styles and `shadow-sm`:
  - Report an injury, page `0:1`, root `3:311`: TextField, an invalid Select, TextArea, a
    disabled TextField, outline and default Buttons.
  - Claims inbox, page `4:186`, root `4:194`: header with a Button, the TabList, five Chips (one
    current, one muted), and a list of four instances of a local `ClaimRow` component (`4:187`,
    text properties `title` and `meta`, a Badge whose colour varies per row). Dividers are a
    `spacing/px` gap over a `gray/200` fill. ClaimRow has no counterpart in `@workers-comp/ui`:
    the app builds it, which figma-flow's "a component with no code counterpart: stop" has to
    allow for.
  - Claim summary, page `5:40`, root `5:41`: header with a Badge, a details list, a paragraph
    that wraps, a ghost Button pushed left by a spacer, outline and default Buttons.
- Still to do: the trap page, then figma-setup and figma-flow.
