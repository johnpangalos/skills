# figma-flow run: page "trap" (node 6:40, file 0Uld8qYjwyl7HJLEMwqxNv)

Outcome: stopped at step 3 (open lint findings). Nothing built, no export, no spec, no page.
Files written: figma/trap-lint.json (lint saved exactly as returned), this log. Figma was only read.

## Steps
0. Read SKILL.md, app CLAUDE.md. App has a mapping, `test:figma` script, tests/figma.ts. OK to proceed.
1. Read the design: create_session, get_metadata 6:40, get_screenshot 6:40. Frame "Trap" 1280x754 > Card 6:41 (frame, 440 wide,
   radius/lg, shadow style, fill #fefefe) > Header (two texts), instances TextField 6:45, Select 6:46, TextArea 6:47, TextField 6:48,
   Actions frame 6:49 > Button instance 6:50 (outline, default, "Save draft") + frame "Continue" 6:82 (a detached Button).
   Components: TextField, Select, TextArea, Button all have code. Card has no code (listed under "No code yet"), but here Card is a plain frame, not an instance.
   States drawn: only default.
2. Lint: `print.ts lint-node 6:40` to a mktemp file, pasted into use_figma (no figma-flow:save line, mod not running), saved result to figma/trap-lint.json.
3. Stopped on gaps. Details below.

## Lint findings, exactly as reported
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-color","field":"fills","value":"#fefefe"}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"paddingTop","value":20}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"paddingRight","value":20}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"paddingBottom","value":20}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"paddingLeft","value":20}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"itemSpacing","value":22}
{"variant":"Trap","layer":"Card","node":"6:41","rule":"raw-number","field":"width","value":440}
{"variant":"Trap","layer":"Card > Header > Step 1 of 3: what happened.","node":"6:44","rule":"raw-type","field":"textStyleId","value":"fontSize fontWeight"}
{"variant":"Trap","layer":"Card > Actions > Continue","node":"6:82","rule":"detached","field":"","value":"Continue"}
hash c7fab9a3

## What matching variants have (read from Figma) and sorting
The skill says "give what the variants it should match have in that layer and field". Reference used: library Card 98:321 (a component, 384 wide),
sibling heading 6:43, Button instance 6:50 (outline) and its main component.

Group 1, changes what is drawn (value unlike what the variable/style gives):
- Card fills #fefefe: library Card fill is white (variable `white`, #ffffff). Visibly different.
- Card padding 20 x4: library Card padding is spacing/6 = 24.
- Card itemSpacing 22: library Card gap is spacing/4 = 16. (22 is on no spacing step.)
- Card width 440: library Card width is spacing/96 = 384.
- "Step 1 of 3" text: size 15, Inter Regular, line height 20 (bound), no text style. Sibling heading uses text-lg/semibold (18/28, 600). The size 15
  is on no text style (text-sm is 14/20, text-base is 16/24); weight 400 matches text-sm/regular or text-base/regular, but the size matches neither. A value with no style: designer question.
- Continue (detached) 6:82: detached copy of Button (componentKey 27cf4789...). It is 94x36 and draws a filled fuchsia primary look, while the
  real Button instance beside it is 104x38 (its 1px stroke counts), outline. It has no stroke, so its height is 36 where a Button with a border is 38. Code must use `<Button>`,
  so the designer must replace it with an instance (variant primary, label "Continue"). Text inside it is linked to text-sm/semibold, fine.
Group 2, only loses a binding (same value, nothing bound):
- None clean. Every Card finding differs from the library Card's value, so I did not put any in this group. Border/stroke: Card has no stroke at all, library Card has gray/200 (not a lint finding, noticed while reading; reported as a note).
Radius and shadow of Card are bound/styled (radius/lg, shadow effect style), fine.

Told the user: Card is a hand-made frame with its own numbers, not a Card instance; code has no Card (CLAUDE.md lists it as no code yet), so also a
component gap even after the findings are fixed. Said plainly that nothing was measured or compared with screenshots, so a clean lint is not the last check.
No finding was added to lint-ignore.json: none is right as it is (they contradict the library Card). Did not edit Figma.

## Why nothing was built
Step 2: "Don't export or build around an open finding." Step 3: "Open lint findings, a component with no code counterpart ... report these to the person now."
Both apply: 9 open findings and Card has no code. Building would require guessing 440/20/22/#fefefe/15px or inventing a Card.

## Unclear / didn't fit in the skill
- Step 2: "Lint the nodes you will export" happens before "Export what Figma says" and before sorting; fine. But the page is a frame containing instances;
  the lint stops at instances, so Header/Card/Actions children are the only things linted. Fine, worked.
- Step 3: "give what the variants it should match have" assumes the node is a component variant. Here the nodes are page-level frames with no variants;
  I had to pick a reference myself (library Card, sibling heading, the Button next to it). Skill gives no rule for picking.
- Step 3: "Sort ... a value unlike the one those variants get from their variable or style" vs "the same value, with nothing bound": for a frame with
  no matching component (Card) every value differs, so the second group came out empty; the skill doesn't say what to do for a hand-built frame with no reference
  (the 15px text has no style at all, so neither group fits; I put it in group 1).
- Step 1 "get the frame's structure ... and the variables and styles it uses": no tool in the skill for variables used; I used use_figma reads, and the library file needed a
  second read. The skill doesn't say read-only use_figma is OK ("Read only: do not change" came from the task).
- "Pass the printed code to use_figma with this as its first line ... // figma-flow:save": mod not running, so I pasted code without it and wrote the file with Write.
  The printed code is JS with types stripped (blank whitespace lines); I pasted it with comments removed, which cannot change the result but is not "as printed".
  Skill says save "exactly as returned"; the returned text had no trailing-newline marker so I assumed a final "\n" (hash line then "}\n", matching how the code builds it).
- Skill said print.ts prints "plain JavaScript"; it ends in `return await lintNode("6:40");` which is right. `--hash` variant used no further.
- Step 3 says "Stop on gaps, before building" but step 4 "If the task hands you a saved export and no Figma access, use that" - n/a here.
- Project CLAUDE.md says to follow it over the skill; it names `tests/<name>.figma.spec.ts` but tests/example.figma.spec.ts does not exist yet ("once it exists").
- The task asks to "Build the page" while the skill says stop on gaps: I followed the skill (stop and report).
