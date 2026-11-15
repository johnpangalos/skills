# Trap page: what was planted

The "Trap" page (page `6:52`, root `6:40`, card `6:41`) is a copy of "Report an injury" (`3:311`)
with six mistakes a designer could make. figma-flow's lint has to report each one, and a
build must not go ahead around them.

| # | Layer | Field | Planted | What it should be |
|---|---|---|---|---|
| 1 | Card | paddingTop/Right/Bottom/Left | 20, unbound | `spacing/6` (24), as on the source page |
| 2 | Card | itemSpacing | 22, unbound, on no step of the scale | `spacing/6` (24) |
| 3 | Card | fills | `#fefefe`, unbound | `white` |
| 4 | Header > "Step 1 of 3…" | textStyleId | no style, 15px | `text-sm/normal` |
| 5 | Actions > Continue | detached | the Button instance detached into a frame | a Button instance, `variant=default` |
| 6 | Card | width | 440, unbound | `container/md` (448) |

Findings 1, 2, 3 and 6 change what is drawn; 4 changes it too (15px against 14px); 5 draws the
same but code can't tell which component it is.
