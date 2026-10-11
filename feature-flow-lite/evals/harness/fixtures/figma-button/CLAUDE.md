# Button from Figma

The design is the Figma "Button" component set. Its export is already in this repo, so no
Figma access is needed:

- `figma/button.json`: every variant with the exact values Figma draws it with (size, fill,
  border, radius, focus rings, and the label's colour, size, weight, line height and position).
  Variant names read `variant=outline, size=sm, state=hover`.
- `figma/button.png`: a picture of the whole set at 1x, laid out by `x` and `y` in the JSON.

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
  and use that utility (`bg-fuchsia-700`), never the hex.
- Tailwind theme utilities only, no arbitrary values (`w-[137px]`, `text-[#a800b7]`).
- A Figma property is the React prop of the same name and value: `variant=outline` is
  `variant="outline"`. `state` is not a prop: hover, active and focus are the browser's own
  (`hover:`, `active:`, `focus-visible:`), and `state=disabled` is the `disabled` attribute.
- The label is `children`. A focus ring is two rings: an inner white gap and an outer colour.

## What to build

- `src/button.tsx` exporting `Button`, a native `<button type="button">` with `variant`
  (`default` | `outline` | `ghost`, default `default`) and `size` (`default` | `sm`, default
  `default`), rendered as `data-variant` and `data-size` attributes. It accepts the usual
  button props and appends `className`.
- `src/app.tsx` rendering, for each variant and size, one enabled and then one disabled
  `<Button>` with the label `Button`, each pair in document order, on a white background with
  at least 16px of space around every button.

Don't change `figma/`, `tests/`, `playwright.config.ts` or the font in `src/styles.css`.
