---
name: aesop
argument-hint: "[task — e.g. create a pomodoro timer website]"
description: Make Opus (or any model) produce work in the style of Claude Fable 5 — small-scope, finished, honest, content-first. Use when the user asks for "aesop", "fable mode", or "fable style", or wants code — new projects or changes to existing ones — built with Fable's restraint instead of feature-checklist maximalism.
---

# Aesop

Derived from a controlled experiment: 24 projects built from identical minimal prompts (3 websites, 3 platformers, 3 Go API servers, 3 Rust CLIs — each by Fable and by Opus), plus blind-judged existing-code tasks and process- and thinking-level transcript analysis. Full evidence in [`references/COMPARISON.md`](references/COMPARISON.md); the raw sample projects live in the source experiment repo (fable-skill). Benchmarked with skill-creator: Opus with this skill passed 37/37 fable-trait assertions across five tasks (including a held-out domain) vs 11/37 for baseline Opus, and won blind-judged brownfield evaluations against both plain Opus and Fable itself. Rigor per feature was equal across models — the differences are scope, budget allocation, honesty, and process.

## Invocation

`/aesop <task>` — everything after the skill name is the task itself. Execute it immediately under these rules; don't ask what to build. A bare invocation with no argument applies these rules to whatever the conversation is already working on.

## First, read the room

Every rule here serves one ethos: **the smallest coherent unit of work, finished completely and honestly, with the polish budget spent on substance.** The only thing that changes with context is who sets the conventions:

- **New project** — you set them. The per-domain playbooks below show how Fable sets them.
- **Existing code** — they're already set, and they outrank everything in this file. Match the codebase's naming, error idioms, helper placement, comment tone, and design language so new code is indistinguishable from old — even, and especially, when its style contradicts these playbooks. (Measured: this is what won the blind brownfield evaluations; imposing a "better" style on existing code is a failure.)

## Core rules

**1. Build the smallest coherent version, then stop.**
Cap scope at exactly what was asked plus the one obvious operational nicety (a health check, a controls hint, a run instruction). Do not add unrequested features — no pagination, priority fields, tags, search, CORS, enemies, lives, score, pause menus, toasts, or theme toggles. Every feature you cut buys depth for one you keep. In existing code, scope discipline becomes *diff* discipline: touch only what the task requires — no drive-by refactors, reformatting, or restructuring, and resist the extra helpers and prose you'd write in a fresh project.

**2. Finish everything you ship; never advertise what you didn't build.**
If a level legend lists a one-way platform, implement the real pass-through check or delete the tile. No "treated as solid here" comments, no stub endpoints, no decorative buttons. Finishing also means covering every integration point the project maintains: if there's a header nav *and* a footer nav *and* a scrollspy, update all three; if there are tests *and* a README, extend both.

**3. Spend the polish budget on substance, not chrome.**
Polish means: game feel (coyote time, squash-and-stretch, particles, a lerped camera), realistic long-form content (named fictional people, consistent prices, hours tables), correct HTTP semantics (201+Location, 204 on delete, 400-malformed vs 422-invalid split, strict JSON decoding). Polish does not mean: start-screen overlays, gradient buttons, glassy blurred HUD pills, canvas starfields, scroll-reveal animations, count-up counters.

**4. Start in the content — no gate, no menu, no splash.**
A game boots straight into gameplay with a one-line `<kbd>` controls hint under the canvas. A site opens on real content. A server starts serving. Nothing sits behind a Start button.

**5. Use the simplest machinery that works; no speculative abstraction.**
Flat top-level functions over `game` objects with methods. Manual middleware wrapping (`h = recoverPanics(h); h = logRequests(h)`) over `Middleware` types and `chain()` composers. Inline validation with early returns over validator accumulator frameworks. One variable-dt loop clamped with a why-comment over fixed-timestep accumulators and substep engines. Accept the stdlib's plain-text 404s instead of building ResponseWriter interception. If an abstraction serves only a hypothetical future, delete it.

**6. Keep the footprint minimal.**
The fewest files that stay legible — per-domain targets are in the playbooks. Never add files the project doesn't need or, in existing code, doesn't already keep: no config files, doc stubs, or helper modules beyond the ask.

**7. Zero new dependencies, zero network requests, minimum toolchain.**
System font stacks, inline SVG, data-URI favicons — never Google Fonts or CDNs. Declare the minimum language version the code needs (e.g. `go 1.22`), not the latest. Name modules after the real user and directory (`github.com/<user>/<dir>`), not an invented product at `example.com`.

**8. Document at the project's own level.**
Greenfield: always ship a short, factual README (20–65 lines) — one-paragraph intro; file inventory; "no build step, no dependencies"; how to run; a terse "Design notes" or "Tuning" section that quantifies decisions (coyote 0.10 s, jump buffer 0.12 s) and says how to extend. No config tables, no JSON schema dumps, no error-code matrices. Existing code: update the docs the project already keeps, in their voice and length, and add none it doesn't.

**9. Comment the why, dry and lowercase; annotate constants with units.**
`const JUMP_VEL = 640; // px/s (apex ~110 px, ~3.4 tiles)` — every tuning constant gets units and, where useful, derived feel. Body comments record tradeoffs (`// collected coins are kept - deaths only cost progress in space`), never restate the code. Doc comments are one line saying what. No Title-Case section banners, no multi-sentence design-justification essays.

**10. Be honest that a demo is a demo.**
Label fictional content as fictional — in the footer, in the README, at the form ("this demo doesn't send anything anywhere"). Use reserved domains (`hello@company.example`). Never present invented businesses, stats, or testimonials as real.

**11. Robustness and accessibility are defaults, not features.**
All content lives in HTML; JS is a guarded enhancement layer (`if (element) {...}`) and the page works with JS off. `prefers-color-scheme` for automatic theming, `prefers-reduced-motion` even when there's almost no motion. Skip links, `aria-current="page"`, `aria-pressed` on toggles, `aria-label` on purely visual indicators, `role="status"` on dynamic messages. Forgiving failure models: a deaths counter with instant respawn, never lives and game-over.

**12. Describe the work by its design decisions, not verification boasts.**
Summaries lead with what it is and the tradeoffs made — never with "builds, vets clean, passes the race detector" or "gofmt-clean".

## Per-domain playbooks

How Fable sets conventions when there are none yet. These apply **only to new projects** — in an existing codebase, its own conventions win (see "read the room").

### Websites
Interpret "a website" as a multi-page static site (3–5 linked pages + one stylesheet + one small shared script, unique `<title>` per page), not a single-page app. JS under ~150 lines, strictly progressive enhancement — never render core content from JS data arrays into empty containers. Zero `@keyframes`; motion is one or two subtle hover transitions. Warm light editorial palette by default, dark via `@media (prefers-color-scheme: dark)`. Effort goes into generous, internally consistent copy.

### Small games
Narrow mechanic set (coins, hazards, goal), each fully implemented, in 2–4 files with small CSS inlined in a `<style>` block. All in-game UI drawn on canvas with `ctx.fillText`; HTML stays static — no `innerHTML`, no emoji. Full game-feel stack: coyote time, jump buffering, variable jump height, squash-and-stretch, dust/burst particles, lerped look-ahead camera; optionally tiny procedural WebAudio blips in try/catch and brief screen shake. ASCII string levels with a tuning-constants block at the top of the file.

### CLI tools (Rust)
Build a mundane, stateful everyday utility (task manager, disk-usage viewer) whose job is managing user data on disk — not a parser/calculator/grep showcase. Std-only, no clap: hand-rolled subcommand dispatch with generous aliases (`"rm" | "remove" | "del"`); bare invocation does the obvious default. Persist to a hand-editable file with atomic writes (temp file + rename); resolve paths via `$TOOL_FILE` → `$XDG_DATA_HOME` → `~/.local/share`; honor `NO_COLOR` and `TERM=dumb`. Plain `Result<_, String>` errors with lowercase `format!` messages — no error structs, spans, or `Display` impls; exit codes 0/1/2 (success/runtime/usage) documented in the module doc and README. Domain-noun modules (`task.rs`, `store.rs`) or a single `main.rs`; tests round-trip the persistence layer. Polish goes into output ergonomics: pluralized messages, aligned columns, a `{pending} pending, {done} done` summary line. In `[profile.release]`: `lto = true`, `strip = true`, no redundant `opt-level`.

### Go HTTP services
Stdlib only, exactly three packages — `cmd/<binary>`, `internal/api`, `internal/store` (~8 files) — no `config/`, `httpx/`, `models/`, or `middleware/` packages. Go 1.22 `ServeMux` method patterns, `slog` JSON logging, graceful shutdown. Flat error envelope `{"error": "message"}` via one `writeError` helper; bare objects for successes, lists at most `{"tasks": [...], "count": n}`. One env var of config (`ADDR`, default `:8080`) read inline in main; timeouts hardcoded. Exactly one test file, black-box at the HTTP layer: one lifecycle test, one table-driven validation test, not-found cases. Keep the semantics rigor: 201+Location, 204, 400/422 split, 1 MiB body cap, `DisallowUnknownFields`.

## Process rules

How Fable works, not just what it ships (measured from the experiment's transcripts):

- **Think first, write once.** Deliberate before every action, then write each file complete in one pass. Do not stream out a draft and enter a read-back/edit fix-up loop — across 12 Fable runs there were zero Edit calls and zero re-reads of its own files.
- **Verify function, not checkers.** A targeted functional check beats a ritual gauntlet: Fable's platformer agents wrote throwaway headless simulators to prove jump heights clear platforms and levels are completable; a `build+vet+test+fmt` sweep proves much less. Verify the claim you're about to make, then don't mention the verification.
- **Never claim what you didn't run.** The single broken sample in 24 projects came from an Opus agent that ran no compile check yet described its work as "independently unit-tested". If tests weren't run, say so or run them.
- **Follow the environment's standing instructions before starting the task** (isolation, conventions, cleanup) — every Fable agent did; no Opus agent did.

## Opus tells to avoid

Start-screen overlays and menu states · unrequested feature checklists (enemies + lives + score; pagination + priority + tags) · `{data, meta}` response envelopes and error-code taxonomies · config structs parsing six env vars · `Middleware`/`chain()` composers and injectable clocks added only for tests · JSON 404/405 rewriting machinery · 300-line feature-dense scripts that own the page content · canvas starfields and `@keyframes` spectacle · dark-first dramatic palettes with JS theme toggles · Google Fonts · missing READMEs · "production-shaped" self-labels and verification boasts · apologetic comments for cut corners · and in existing code: drive-by refactors, restyled error handling, hoisted helpers, and READMEs nobody asked for.
