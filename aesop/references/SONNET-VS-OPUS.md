# Sonnet 5 vs Opus, with and without the aesop skill

**Method.** Rerun of the original experiment's task set — "Create a website.", "Create a simple platformer.", "Create an API server in golang.", "Create a command-line tool in rust." — one run per task per condition, four conditions: Sonnet 5 (`claude-sonnet-5`) and Opus (`claude-opus-4-8`), each bare (control) and each with the full aesop SKILL.md inlined in the prompt. 16 generation agents ran in parallel from identical prompts (skill runs differed only by the skill block). Outputs were placed in anonymized directories (`<task>-{a..d}`, mapping randomized per task) and each task's four variants were blind-ranked by one judge agent (Fable) scoring five dimensions ×10. Tokens = subagent output tokens (includes invisible thinking) as reported by the harness; speed = wall-clock per run. All 16 projects passed independent verification (`go build/vet/test`, `cargo test`, `node --check`).

**Headline.** The skill dominates quality regardless of model: skill runs took 1st and 2nd place in all four blind rankings (Opus+skill won platformer and go-api; Sonnet+skill won website and rust-cli — a dead heat on rank points, 14–14). Opus-control was 3rd all four times and Sonnet-control last all four times. On cost, the models inverted expectations: **Opus was ~2× cheaper and ~2.3× faster than Sonnet 5 in both conditions.** The skill costs Opus +29% tokens / +59% wall-clock; for Sonnet it is roughly token-neutral (scope savings cancel against verification spend). Sonnet 5's extra budget went into self-verification loops (Playwright, headless sims, smoke tests — up to 75 tool calls in one run), which produced the two most-verified games but also the two most bloated controls.

## Blind quality rankings (per task)

| task | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| website | **sonnet-skill** (45/50) | opus-skill (39) | opus-control (32) | sonnet-control (25) |
| platformer | **opus-skill** (45/50) | sonnet-skill (44) | opus-control (34) | sonnet-control (23) |
| go-api | **opus-skill** (45/50) | sonnet-skill (42) | opus-control (32) | sonnet-control (28) |
| rust-cli | **sonnet-skill** (44/50) | opus-skill (43) | opus-control (37) | sonnet-control (34) |

Aggregate judge score (max 200): sonnet-skill **175**, opus-skill **172**, opus-control 135, sonnet-control 110.

The skill's effect (+40 for Opus, +65 for Sonnet, out of 200) is much larger than the model gap in either condition (≤3 points between skill runs; 25 between controls). With the skill, the choice of model is a coin flip on quality; without it, Opus degrades more gracefully than Sonnet.

## Tokens and speed (totals across the 4 tasks)

| condition | output tokens | wall-clock | tool uses | avg tokens/run |
|---|---|---|---|---|
| opus-control | 141,354 | 11.2 min | 47 | 35,339 |
| opus-skill | 182,012 | 17.8 min | 52 | 45,503 |
| sonnet-control | 277,108 | 25.9 min | 127 | 69,277 |
| sonnet-skill | 282,580 | 26.6 min | 112 | 70,645 |

- **Opus is the economical model at both ends**: cheapest and fastest with or without the skill. Opus+skill (182k, 17.8 min) delivered near-top quality for 66% of sonnet-control's tokens and 69% of its wall-clock — while beating it on every single task.
- **The skill's cost depends on the model.** Opus: +40k tokens (+29%), mostly the READMEs, accessibility work, and functional verification the controls skipped. Sonnet: +5k (+2%) — on three of four tasks the skill *cut* Sonnet's spend by 24% (148k vs 194k), but the platformer run went on a 134k-token verification binge (a throwaway Python physics replica *and* a Playwright end-to-end run; 75 tool calls, 17.4 min) that erased the savings.
- **Sonnet 5's signature is verification appetite.** Its four control runs averaged 3× Opus-control's tool calls; it found and fixed real bugs mid-run (a flag hitbox players could sail over, a wordmark wrap) but spent tokens like Fable without Fable's write-once economy.

Per-run: website o-ctl 33.6k/2.4m, s-skill 47.9k/2.9m, o-skill 47.1k/4.8m, s-ctl 102.7k/9.8m · platformer o-ctl 30.4k/1.9m, s-ctl 82.9k/9.7m, o-skill 53.1k/6.4m, s-skill 134.1k/17.4m · go-api o-skill 36.8k/2.5m, s-ctl 39.3k/2.2m, o-ctl 41.0k/3.5m, s-skill 49.7k/3.2m · rust-cli o-ctl 36.4k/3.4m, o-skill 45.1k/4.1m, s-skill 50.9k/3.1m, s-ctl 52.3k/4.2m.

## What the judges saw

**Websites.** Sonnet+skill's five-page bookshop won on airtight cross-page consistency (event dates, staff-pick counts, and hours tables all agree) with a 7-line JS file. Opus+skill matched it on content but shipped all five pages without `<!doctype html>`/`<html lang>` (quirks mode) plus a cross-page title inconsistency. Both controls built unlabeled-as-fictional single-page apps; sonnet-control's synth-workshop page — the most visually ambitious artifact of the 16 (inlined WOFF2 fonts, canvas oscilloscope) — hides *all* core content behind `.reveal { opacity: 0 }` with JS off and drops navigation entirely under 900px.

**Platformers.** Both skill runs shipped the full feel stack (coyote 0.10s, buffer 0.12s, jump-cut, squash, particles, lerped camera), deaths-counter respawn, no menu, unit-annotated constants — and both verified completability with headless simulations. Opus+skill edged Sonnet+skill on one real bug: Sonnet created its AudioContext inside the rAF loop without a user gesture, so its advertised audio is silent in Chrome. Sonnet-control built the classic checklist (lives, score, timer, enemies, two levels, touch controls, start gate) with zero feel techniques — "effort went wide instead of deep."

**Go APIs.** Opus+skill scored 9s across the board: the only variant nailing every semantics checkpoint (201+Location asserted in tests, 400/422 split, 413, trailing-data rejection) in the three-package/one-test-file shape. Sonnet+skill was a close second (same shape, slightly less rigor). Notably, *both* controls were far leaner than the original experiment's Opus controls — no pagination, no envelopes, no middleware chains — but opus-control still shipped an unrequested Dockerfile/Makefile and an injectable clock no test uses, and sonnet-control shipped no README and a PUT aliased to PATCH that can't validate or clear a title.

**Rust CLIs.** Both skill runs independently built the playbook tool (std-only todo manager, atomic writes, XDG paths, 0/1/2 exit codes, aligned columns). Sonnet+skill won on terminal hygiene (`NO_COLOR`, `TERM=dumb`, `is_terminal`); opus+skill had better parsing craft (loud line-numbered errors on malformed hand-edits, all-or-nothing bulk operations) but leaks ANSI into pipes. Opus-control built a stateless text-analysis showcase (wc/grep/tr re-implementations, clap). Sonnet-control's seven-dependency task manager had the set's worst durability flaw: a plain `fs::write` on the JSON store — no temp-file+rename — in the one place atomicity matters most.

## Trait compliance

All eight skill runs passed the key fable-trait markers regardless of model: README present, honesty labels + `.example` domains, no start screens, deaths counters + coyote time, exactly three Go packages + one black-box test file + flat error envelope, std-only stateful CLIs with atomic writes. Neither model imposed the aesop aesthetic where it didn't belong, and neither control was as maximalist as the original experiment's Opus controls (opus-control even converged on deaths-counter + coyote unprompted) — but only the skill produced the honest-labeling, README, and semantics-rigor traits reliably.

## Takeaways

1. **The skill transfers cleanly to Sonnet 5.** It was written from Fable-vs-Opus evidence, but Sonnet+skill matched Opus+skill blind (two wins each, 175 vs 172 aggregate) and swung Sonnet's quality more than Opus's (+65 vs +40 of 200) — Sonnet has the bigger baseline gap for the skill to close.
2. **Skill > model choice.** Both skill runs beat both controls on every task. If you can only pick one lever, pick the skill.
3. **Opus+skill is the efficiency pick** — near-top quality at 64% of Sonnet's tokens and 67% of its wall-clock. Sonnet+skill is the pick when its verification appetite is a feature (it's the only condition that end-to-end-tested its games in a real browser), if you accept occasional runaway runs (its platformer cost 2.5× Opus+skill's).
4. **Sonnet 5 bare is the worst configuration**: most tokens, slowest, and last in all four blind rankings — the extra spend goes to features and verification of features nobody asked for.

**Caveats.** One run per cell (the original used three), so per-task results are directional. The judging rubric operationalizes the aesop ethos itself (scope discipline, honesty, feel), which structurally favors skill runs — though the decisive defects the judges cited (quirks-mode pages, JS-off-blank content, silent audio, non-atomic writes, missing READMEs) are objective and condition-independent. Judges were blind to condition and model; directory letters were randomized per task. Token counts include invisible thinking tokens and skill runs pay ~2.5k extra *input* tokens per request for the skill text (not counted here). Samples were generated in an ephemeral session and are not preserved in this repo.
