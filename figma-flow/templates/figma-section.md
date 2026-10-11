## Figma

<!-- Written by figma-flow on its first run in this repo, into FEATURE_FLOW.md, then kept up
to date by its runs. It says where this repo keeps what figma-flow needs. Edit it like the
rest of the file. -->

- Source: <the Figma file's URL or key, and which page or frames are the design>
- Mapping: <where the rules for turning Figma into code are written, e.g. CLAUDE.md
  "Turning Figma into code"; or the rules themselves if they are nowhere else>
- Export: <the command or script that writes a node's values, and the folder exports are kept
  in, e.g. `node figma/print.ts export-node <id>` through use_figma, saved to
  apps/playground/figma/<name>.json>
- Measure: <the command that compares rendered values with an export; its name contains
  `test:figma` so the mod sees it>
- Page: <how a design is rendered for the measurement and for a screenshot: the dev server
  command, the URL pattern, where pages for this live>
- Can't be measured: <what the export or the test can't read here, which only looking covers;
  or "nothing known">

<!-- Also add these lines to the sections above, then delete this comment.

Checks, Targeted: the Measure command, for any change that started from Figma.
Standing criteria: Figma decides: no approximated values, and a design that looks wrong is
  reported, not fixed in code. Theme utilities and existing components only.
Reviewer checklist: every node in the export is covered by the measurement; every state the
  design draws is reached the way a person reaches it; nothing in the diff loosens the
  comparison or edits an export by hand.
-->
