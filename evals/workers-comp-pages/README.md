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

### 2. figma-setup (Sonnet, about 4 minutes; log in `runs/figma-setup.md`)

Typecheck, build and `test:figma` pass; the saved files' hashes match their bodies (checked).

- **The worked example measures one value.** `export-node 3:311` returns one entry, the page
  frame: it has one child, the card, and the export goes one level deep. Everything on the page
  is below it.
- **`export-tokens` returns nothing from a consumer file.** It reads local variables; the pages
  file only uses the library's. The agent pointed it at the design system file instead; the
  skill doesn't say which file the tokens come from.
- **The lint check template never runs.** It is `figma-lint.spec.ts`; the config template matches
  `*.figma.spec.ts`. The first run found no tests; the agent renamed it.
- **The mapping template assumes Tailwind.** This app has none; the agent mapped to the package's
  CSS variables (`var(--color-gray-900)`, `calc(var(--spacing) * 6)`), which work. Step 6 (the
  token check) exists only for Tailwind with Vitest, so tokens aren't checked here.
- **The app serves no Inter.** `@workers-comp/ui/styles.css` names Inter and ships no
  `@font-face`, so text falls back to whatever the machine has (Inter 4 in this sandbox).
- The installed `@playwright/test` wants a Chromium build the sandbox doesn't have (environment).

### 3. figma-flow on the trap page (Sonnet, about 1.5 minutes; log in `runs/figma-flow-trap.md`)

- **Caught all six planted mistakes** (nine findings: padding is one per side) and **built
  nothing**, as step 2 says. The agent didn't see `runs/trap-planted.md`.
- **Its "should be" values were wrong for three of six.** Step 3 has it give "what the variants
  it should match have in that layer and field". A page has no variants, so it compared the card
  with the library's Card component, which this card isn't, and told the designer gap
  `spacing/4` (16; truth `spacing/6`, 24), width 384 (truth `container/md`, 448), and compared the
  detached Continue with the outline Button (truth: the default one). The fill, padding and text
  style were right. A designer following the report would have made the page wrong.
- It noticed the design system has a Card component in Figma with no code in the package, and
  that the pages draw cards as frames instead. A real designer would likely have used Card.

### 4. figma-flow on Report an injury (Sonnet, about 4 minutes; log in `runs/figma-flow-report-an-injury.md`)

Built `src/pages/report-an-injury.tsx` from the package's components and CSS variables. First
`test:figma`: 6 of 8 failed (no browser); after `PW_CHROMIUM=/opt/pw-browsers/chromium`, 2 failed;
after one fix round (the Actions row stretched Continue to 38px), **7 of 8 pass**. The last
fails on Save draft's width, 102.75px against Figma's 104px (allowed under 1px): text in Inter 4
against Figma's 3.19. Left failing, rightly.

- **It worked around the one-level export** by exporting ten ids (page, card, header, the four
  fields, the actions row, both Buttons): what the skill allows, and the only way to reach a page.
- **Same-named nodes overwrite each other in the export.** Keys are names, so the two TextFields,
  the two Buttons and their children collide: four keys appear twice, and JSON keeps the last.
  The Date of injury field is measured against the Employer field's entry (it passes because
  they're the same size), and the Employer label isn't measured at all. Nothing warns. Pages
  repeat components all the time (Claims inbox has four ClaimRows), so this has to be fixed
  before more pages.
- **Not measured:** the header's subtitle, the TextArea's description, the Select's error text
  (text-only nodes), the chevron, the card's shadow.
- **The label check reads typography from the container,** because the export puts a frame's
  first text child on the frame. The agent set the label's text style on the field wrappers and
  the header in page CSS to satisfy it. The values are the design system's, but it's CSS written
  for the test, not for the page.
- **The looker wasn't blind.** A subagent can't spawn another agent, and the skill's fallback is
  another agent; the agent compared the screenshots itself.
- `--hash` hashes the whole printed file, the in-file hash only its body, so the two can't be
  compared directly; the skill implies they can.

## What to fix, from the results so far

1. `export-node`: key entries by id (or name plus id) so repeats can't collide, and fail on a
   duplicate key; walk the whole tree, or take a depth; include text nodes with their style.
2. figma-flow step 3: for a page, the reference for a finding is the same layer on an unbroken
   page or the variable's scale, not the nearest library component; say so, or skip "should be".
3. `export-tokens`: read the library's variables when the file has no local ones (or say to run it
   on the library file).
4. figma-setup templates: name the lint spec to match the config's pattern; a mapping section for
   apps without Tailwind; tell the app to serve Inter 3.19.
5. figma-flow's look step: a fallback when no agent can be spawned (run it from the orchestrator,
   or ask the person).
