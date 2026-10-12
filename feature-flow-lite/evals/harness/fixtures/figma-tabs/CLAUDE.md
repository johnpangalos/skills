# Tabs from Figma

The design is the Figma "Tabs" page. Its export is already in this repo, so no Figma access
is needed:

- `figma/tabs.json`: every part with the exact values Figma draws it with (size, fill, border,
  radius, focus rings, layout gap and padding, and the label's colour, size, weight, line
  height and position). `Tab/selected=true, state=focus` is a variant of the Tab component;
  `TabList`, `TabPanel` and `Tabs` are the parts, and `TabList > Overview` is a tab as it sits
  inside the list.
- `figma/tabs.png`: a picture of the Tabs component at 1x. `figma/tab-states.png`: the Tab
  variants in the JSON's order (the selected ones are white on white there).

## Commands

Use pnpm.

```sh
pnpm typecheck
pnpm test:figma   # Playwright: rendered values against Figma's, exactly
pnpm dev          # http://localhost:5199
```

## Turning Figma into code

Figma decides. Don't approximate a value.

- Colours in the export are Tailwind v4 default palette colours. Find which one each hex is
  and use that utility (`bg-gray-100`), never the hex.
- Tailwind theme utilities only, no arbitrary values (`w-[137px]`, `text-[#101828]`).
- A Figma property is the React prop or ARIA state of the same meaning: `selected=true` is the
  selected tab (`aria-selected="true"`). `state` is not a prop: hover and focus are the
  browser's own (`hover:`, `focus-visible:`), and `state=disabled` is the `disabled` attribute.
- A label is `children`. A focus ring is two rings: an inner white gap and an outer colour.
- `layout` is flexbox: `direction`, `gap`, and `padding` as top, right, bottom, left.

## What to build

- `src/tabs.tsx` exporting `Tabs`, `TabList`, `Tab` and `TabPanel`:
  `<Tabs defaultValue? value? onValueChange?>` containing `<TabList aria-label>`,
  `<Tab value disabled?>` and `<TabPanel value>`. A `Tab` is a native `<button type="button">`.
  The `Tabs` root element is the direct parent of the tab list.
- `src/app.tsx` rendering one `<Tabs defaultValue="overview">` with the tabs Overview, Activity
  and Settings (Settings disabled) and the panels "Overview panel", "Activity panel" and
  "Settings panel", on a white background with at least 16px of space around it.

Don't change `figma/`, `tests/`, `playwright.config.ts` or the font in `src/styles.css`.
