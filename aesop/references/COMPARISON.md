# Fable vs Opus: controlled comparison

**Method.** Twenty-four projects were generated from identical, minimal prompts — "Create a website.", "Create a simple platformer.", "Create an API server in golang.", "Create a command-line tool in rust." — three repetitions each by `claude-fable-5` and three by Claude Opus (`claude-opus-4-8`), with no other guidance. All outputs are preserved verbatim in the source experiment repo (fable-skill) under `samples/<model>/<task>-<n>/`; they are not vendored into this repo. One comparison agent per task then read all six of that task's projects and reported only traits that held for at least 2 of a model's 3 samples and were absent or clearly weaker on the other side.

**Headline.** The rigor per feature is comparable between the models. The systematic differences are **scope discipline** (Fable builds the smallest coherent version and finishes it; Opus roughly doubles the feature surface and the line count), **where the polish budget goes** (Fable: content, game feel, HTTP semantics, accessibility; Opus: menus, animation spectacle, envelopes and abstractions), and **honesty** (Fable labels fiction as fiction and never advertises a mechanic it didn't implement; Opus shipped "one-way-ish, treated as solid" platforms and leads its self-reports with verification boasts). Beyond the artifacts, the models also differ in *process* and in how much they *think* — see the two sections at the end. The distilled instructions live in [SKILL.md](../SKILL.md).


## Website ("Create a website.")

On the open-ended prompt "Create a website", fable and opus diverge on what a website even is. All three fable reps converged on the same interpretation: a multi-page (3-5 page) static brochure site for a fictional coffee roastery, with a shared stylesheet, a tiny (47-127 line) ES5 progressive-enhancement script guarded by element checks, a README with run instructions, zero @keyframes, zero network requests, automatic prefers-color-scheme theming with a warm light default, dense realistic editorial copy, heavy systematic accessibility (aria-current, aria-pressed, skip links, labeled indicators), and explicit fictional/demo disclaimers down to .example email domains. All three opus reps instead built a single-page interactive experience or app (animated landing page, canvas-starfield astronomy guide, full Pomodoro timer) — exactly three flat files, no README, 300-370 lines of feature-dense JS (canvas animation loops, IntersectionObserver reveals, toasts, Web Audio, localStorage state), animation-forward dark-first design, and in 2/3 cases core content rendered from JS data arrays so the page is hollow without JavaScript. To make opus write like fable: force the multi-page-static interpretation, cap and de-scope the JS to guarded progressive enhancement, ban animation spectacle, require a README and fictional-content disclaimers, and redirect the effort budget from interactive features into pages, copy, and accessibility.

### Fable traits (held in ≥2/3 samples, weak/absent in Opus)

- Interprets 'a website' as a multi-page static brochure site: 3/3 built a fictional small-batch coffee roastery with 3-5 linked HTML pages (index/coffees/about/visit/brewing) sharing one stylesheet and one JS file; opus never produced more than a single index.html.
- Ships a README.md in 3/3 reps, short and factual: a Pages list, run instructions (open index.html or `python3 -m http.server`), and notes on stack/theming/no-JS behavior.
- Progressive enhancement discipline: all content lives in HTML; JS is a small enhancement layer (47-127 lines: mobile nav toggle, roast filters, client-side form message, brew calculator, today-row highlight), each feature guarded by `if (element)` existence checks so one script safely serves every page. READMEs explicitly say 'Everything degrades gracefully with JavaScript disabled.'
- Restrained motion: zero @keyframes across all three reps, only 2-4 CSS transitions per site (button hover), plus a prefers-reduced-motion block anyway.
- Systematic accessibility: 64-90 aria attributes per site; skip links (2/3), aria-current="page" on nav, aria-pressed on filter buttons, aria-label on visual indicators (e.g. roast-scale dots: aria-label="Roast level 2 of 5"), role=status + aria-live on form messages.
- Honest fiction: 3/3 label the content as fictional/demo — footer 'A fictional roastery, for demonstration', form note 'This demo site doesn't send anything anywhere', README 'Everything (farms, people, prices) is fictional', and RFC-reserved contact domain hello@meridianroasting.example.
- Automatic theming via prefers-color-scheme with CSS custom properties in 3/3 (warm light palette as default, dark as media-query override); strictly zero network requests (system font stacks, inline SVG art, data-URI favicon).
- Dense, realistic editorial copy: named fictional farmers and lots, opening-hours and transit tables, staff bios, brew-ratio reference tables — content depth over interactive spectacle.
- Conservative ES5 JS in 3/3: IIFE + "use strict", var/function only, no arrows, no template literals, event delegation on container elements.

### Opus traits (held in ≥2/3 samples, weak/absent in Fable)

- Builds a single-page experience or app instead of a multi-page site: 3/3 shipped exactly index.html + styles.css + one JS file (a scroll-y landing page, an astronomy 'field guide', a full Pomodoro timer app); no second page, no README in any rep.
- Large, feature-dense JS (300-370 lines): canvas starfield/ambient animations with requestAnimationFrame in 2/3, IntersectionObserver scroll-reveal and count-up stat counters, toast notification systems in 2/3, SVG progress-ring timers in 2/3, Web Audio synthesized chime, localStorage app state.
- Animation-forward visual design: 1-4 @keyframes per rep (float, steam, spin, marquee, rise) and 9-15 CSS transitions; hero spectacle like a CSS-drawn floating coffee cup with steam and orbiting beans, or a full-viewport twinkling parallax starfield.
- Renders core page content from JS data arrays into empty containers (2/3): opus-2 builds constellation cards and the planets list via innerHTML from `const constellations = [...]`; opus-3's timer/tasks UI is entirely JS-driven — the page is hollow without JavaScript.
- Dark, dramatic default palettes (2/3 dark-first: #070a16 / #0b0f1a backgrounds, gold/indigo accents) with JS-managed data-theme toggling rather than pure prefers-color-scheme.
- Compact, clever CSS formatting: many one-line rules (`.cup { position: relative; animation: float 6s var(--ease) infinite; z-index: 3; }`; avg line length 57 chars vs fable's 17) and column-aligned custom-property blocks.
- Willing to reach off-box: opus-2 loads Google Fonts (Fraunces + Inter) via preconnect/link; fable never makes a network request.
- Self-reports verification ('JS passes node --check', 'CSS braces balanced') and treats novelty of concept as a goal ('a calm editorial astronomy site rather than a generic product landing page').

### Dimension-by-dimension

**Scope / interpretation of the task**
- Fable: A content-first multi-page static website for a fictional business; ambition goes into pages, copy, and information architecture (menu page, brew guides, visit page with hours and transit).
- Opus: A single-page interactive experience or web app; ambition goes into features and animation (brew timer with SVG ring, moon-phase calculator, working Pomodoro app with tasks and audio chime).
- Evidence: fable/website-3 has index.html, coffees.html, brewing.html, about.html, visit.html; opus/website-3 is a 370-line app.js Pomodoro timer behind one index.html.

**File and project structure**
- Fable: 6-8 files: 3-5 HTML pages + shared styles.css + shared main.js/script.js + README.md (website-3 even uses css/ and js/ subdirectories).
- Opus: Exactly three flat files in all reps: index.html, styles.css, script.js/app.js. No README.
- Evidence: ls fable/website-1 → about.html index.html main.js README.md roasts.html styles.css visit.html; ls opus/website-1 → index.html script.js styles.css

**JavaScript scope and philosophy**
- Fable: 47-127 lines of progressive enhancement; every feature wrapped in an existence check (`var calc = document.querySelector("[data-calculator]"); if (calc) {...}`); site fully readable with JS off.
- Opus: 300-370 lines; JS owns core behavior and sometimes core content — opus-2 injects constellation cards via `grid.innerHTML` from a data array into an empty `<div id="const-grid">`; opus-3's entire UI is JS-rendered state.
- Evidence: fable/website-1/main.js is 47 lines (nav toggle + demo form); opus/website-1/script.js is 301 lines (theme, scroll spy, IntersectionObserver reveals, count-up stats, toasts, filters, cart counter, recipe scaler, brew timer).

**Motion and visual polish**
- Fable: Zero @keyframes in all 3 reps; motion is a 1px hover translateY on buttons, explicitly disabled under prefers-reduced-motion. Polish is typographic: serif display font stack, eyebrow labels, hairline borders, warm palette.
- Opus: 1-4 @keyframes per rep plus requestAnimationFrame canvas loops in 2/3: floating cup + steam + orbiting beans + infinite marquee (opus-1), 240-star parallax starfield (opus-2), drifting ambient stars (opus-3).
- Evidence: grep '@keyframes' across fable → 0 hits; opus/website-1/styles.css defines float, steam, spin, marquee.

**Accessibility depth**
- Fable: 64-90 aria attributes per site; aria-current="page", aria-pressed on filters, aria-label on roast-dot scales, skip links, role=status/aria-live form messages, labeled nav toggle.
- Opus: 20-40 aria attributes; covers the basics (aria-expanded, aria-live toast, reduced-motion fallbacks) but no aria-current, fewer labeled widgets, skip link only in 1/3.
- Evidence: fable card: <div class="roast-scale" aria-label="Roast level 2 of 5"> vs opus meter: <ul class="meter" aria-label="Flavor profile"><li><i style="--v:92%"></i> (bars unreadable to AT).

**Docs / README**
- Fable: 3/3 include a 21-36 line README.md: page inventory, 'no build step, no dependencies', how to open/serve, and a fictional-content note.
- Opus: 0/3 website reps include any README or docs file.
- Evidence: fable/website-2/README.md ends with a runnable snippet: ```sh\npython3 -m http.server --directory .\n```

**Honesty about fictional content**
- Fable: 3/3 explicitly flag the demo nature in-page and in README; reserved .example email domain.
- Opus: Only opus-1 notes 'This is a fictional demo site.'; opus-2 and opus-3 present as real products; opus-1 uses plausible-looking hello@meridian.coffee.
- Evidence: fable/website-1/visit.html: 'This demo site doesn't send anything anywhere — in production this form would post to our inbox.' + hello@meridianroasting.example

**Theming and dependencies**
- Fable: Automatic light/dark via @media (prefers-color-scheme: dark) overriding :root custom properties; warm light default; system fonts only, zero network requests in 3/3.
- Opus: 2/3 dark-first designer palettes with JS-set data-theme; opus-2 loads Google Fonts (Fraunces, Inter) from fonts.googleapis.com.
- Evidence: fable :root { --bg:#faf7f2; } + @media (prefers-color-scheme: dark) { :root { --bg:#17130f; } } vs opus-2 <link href="https://fonts.googleapis.com/css2?family=Fraunces...">

**Code style and formatting**
- Fable: ES5 throughout (var/function IIFE, no arrows/template literals in 3/3); CSS strictly one declaration per line with dashed banner comments (/* ---- header / nav ---- */); avg CSS line ~17 chars.
- Opus: Mixed idiom (opus-2 is full ES6 const/arrows/template literals); CSS compressed onto single lines with aligned token blocks; avg CSS line 26-57 chars.
- Evidence: opus-1: `.orbit-1 { width: 340px; height: 340px; animation: spin 26s linear infinite; }` vs fable's multi-line rules; opus-2 JS: `lines += \`<line class="line" x1="${pa[0]...}"/>\``

**Copy and content density**
- Fable: Long-form grounded editorial copy across pages: named fictional farmers ('the Rodríguez family plot'), staff bios, transit tables, opening hours with a Closed-for-maintenance day, brew-ratio tables.
- Opus: Punchy marketing copy on one page: taglines ('coordinates you can taste'), count-up stat rows (Origins 14 / Roast-to-door 24hrs / Cups 90k+), a 4-item timeline.
- Evidence: fable/website-1/about.html gives three team members two-sentence bios each; opus-1 compresses story into one hero + a <dl class="hero-stats"> with data-count attributes.


## Platformer ("Create a simple platformer.")

Both models produce competent zero-dependency canvas platformers with ASCII tile maps, parallax backgrounds, and coyote-time/jump-buffer feel, but they diverge sharply in philosophy. Fable ships a small, finished toy: it boots straight into gameplay with no menu, restricts scope to coins/spikes/flag with a forgiving deaths-counter (never lives or game-over), draws every piece of UI on the canvas with static HTML and no emoji, uses one simple seconds-based dt loop with unit-annotated tuning constants and rationale-bearing lowercase comments, honestly implements everything its legend advertises (real one-way platforms), and spends its polish budget on in-game juice (squash-and-stretch, particles, screen shake, WebAudio) plus a tuning-oriented README — all in 2–4 files, ~20% less code. Opus builds a bigger arcade shell: a styled DOM title overlay and Start button, enemies with stomp AI, lives/hearts/game-over (and in one rep score, pause, double-jump), a separate 100+ line stylesheet of glassy menu chrome, emoji HUDs and innerHTML-injected end screens, heavier engine machinery (substep loops, fixed-timestep accumulators, STATE-enum objects), a fudged 'one-way-ish, treated as solid' platform in 2/3 reps, and usually no README. To make opus write like fable: cut the menu and the feature checklist, keep the HTML static and the loop simple, implement exactly what you advertise, comment the why not the what, and reinvest everything saved into game feel and a tuning-focused README.

### Fable traits (held in ≥2/3 samples, weak/absent in Opus)

- Boots straight into gameplay on page load — no title screen, no Start button, no menu state; a one-line controls hint (styled <kbd> keys) sits permanently under the canvas (3/3; 0/3 opus)
- Narrow, curated mechanic set: coins + spikes + pits + flag only — no enemies, no lives, no score, no pause (3/3; opus has enemies 3/3)
- Deaths-counter failure model with instant respawn and no game-over; end screen presents deaths/coins/time as stats and 'press R to play again' (3/3)
- All in-game UI drawn on canvas with ctx.fillText; HTML stays static — zero innerHTML injection and zero emoji anywhere (3/3)
- Single consistent physics idiom: variable dt in seconds clamped with a why-comment, constants in real units (px/s, px/s^2) each annotated, sometimes with derived feel ('apex ~110 px, ~3.4 tiles') (3/3)
- Comments carry design rationale and tradeoffs in a lowercase, dry voice ('deaths only cost progress in space', 'walls at the level edges', 'keep feet planted while squashing') (3/3)
- Mechanics in the tile legend are actually implemented — one-way platforms get a real prevBottom pass-through check, or the tile is omitted entirely (3/3)
- Polish budget spent on game feel: coyote time ~0.1s, jump buffer ~0.12s, variable jump height, squash-and-stretch, particles, lerped camera in all reps; extras like WebAudio blips, screen shake, blinking eyes, run-cycle feet in individual reps (3/3)
- Minimal file footprint: 2–4 files, page CSS inlined in index.html in 2/3 reps; ~20% fewer total lines than opus
- README (2/3) includes a Markdown controls table plus 'Implementation notes' and 'Tuning' sections that quantify feel parameters and explain how to edit/add levels

### Opus traits (held in ≥2/3 samples, weak/absent in Fable)

- DOM title-screen overlay with a heavily styled gradient Start/Play button and a 'menu' game state gating play (3/3)
- Patrolling enemies with wall/ledge turn-around AI and a stomp-to-kill + bounce mechanic (3/3)
- Lives/hearts system with a GAME OVER fail state (2/3), plus score points, double-jump and pause in opus-3
- DOM-based HUD and end screens, including runtime innerHTML injection of overlay markup with re-bound button listeners (2/3 inject HTML; 3/3 DOM overlays); emoji/glyph HUD icons like 🪙 ❤️ 🎉 (2/3)
- Separate ~100–120 line style.css invested in UI chrome: backdrop-filter glass, @keyframes pop, clamp() typography, button hover/active transforms (3/3)
- Heavier engine machinery, one flavor per rep: physics substep loop, fixed-timestep accumulator with per-frame constants plus a mergeSolids rect optimizer, or a STATE-enum game-object state machine (3/3)
- Advertises a one-way platform tile in the legend but collides it as fully solid, with an apologetic comment ('one-way-ish ... treated as solid here') (2/3)
- 'Cloud'-themed daytime branding (Cloud Hopper, Cloudleap) with CSS-lettered hero titles (2/3)
- README absent (2/3); self-promotion moved into the page itself (footer note 'Built with vanilla JavaScript ... no dependencies')

### Dimension-by-dimension

**Scope / feature ambition**
- Fable: Deliberately narrow mechanic set: coins, spikes, pits, goal flag, deaths counter. No enemies, no lives, no score, no pause, no double jump in any rep. Effort goes into depth-per-mechanic instead.
- Opus: Arcade feature checklist: all 3 reps add patrolling enemies with a stomp mechanic; 2/3 add a lives/hearts system with a game-over state; opus-3 additionally adds score points (+10/+25/+50), double-jump, and a P pause key.
- Evidence: opus/platformer-3/game.js: `game.score += 25` on stomp, `jumpsLeft = 2`, `togglePause()`. No fable game.js contains an enemy, a life, or a score — fable/platformer-1 instead has `bankedCoins` and the comment `// collected coins are kept - deaths only cost progress in space`.

**Boot flow / menus**
- Fable: Game starts playing immediately on page load; controls are a one-line always-visible hint under the canvas (`.hint`/`.help` with <kbd> tags). No title screen, no button.
- Opus: All 3 reps gate the game behind a DOM title overlay with a styled Start/Play button and a `menu` state; controls live inside the overlay panel.
- Evidence: fable/platformer-1/game.js ends `loadLevel(0); requestAnimationFrame(frame);` with `<div class="hint">` in index.html. opus/platformer-1/index.html has `<div id="overlay" class="visible"><h1>Cloud Hopper</h1>...<button id="start-btn">Start</button>` and game.js `let state = "menu"`.

**Failure model**
- Fable: Forgiving: instant respawn, a HUD `Deaths` counter in all 3 reps, no fail state; end screen reports deaths/coins/time as stats.
- Opus: Punitive: 2/3 reps use 3 lives with hearts and a GAME OVER screen (`if (lives <= 0) state = "gameover"`).
- Evidence: fable/platformer-3/index.html: `<span id="hud-deaths">Deaths 0</span>`; opus/platformer-1/game.js: `hud.lives.textContent = "❤️ " + Math.max(0, lives)` and `showOverlay('<h1>Game Over</h1>...')`.

**UI rendering strategy**
- Fable: All in-game UI (HUD, level-clear banner, win screen) is drawn on the canvas via ctx.fillText; HTML stays static; zero innerHTML use, zero emoji.
- Opus: HUD and end screens are DOM elements; 2/3 reps inject end-screen markup with `overlay.innerHTML = ...`/`showOverlay(html)` and re-bind button listeners; 2/3 use emoji/glyph HUD icons.
- Evidence: fable/platformer-1 `drawWin()` paints 'YOU MADE IT!' with ctx.fillText; opus/platformer-2/game.js: `overlay.innerHTML = '<div class="panel"><h1>You made it!</h1>...'`; opus/platformer-1: `hud.coins.textContent = "🪙 " + totalCoins`.

**File / project structure**
- Fable: 2–4 files; 2/3 reps inline the page CSS in a <style> block inside index.html; README present in 2/3.
- Opus: Always 3–5 files with a substantial separate style.css (99–122 lines) devoted to menu/HUD chrome; README in only 1/3.
- Evidence: fable/platformer-2 is just index.html (45 lines, CSS inline) + game.js + README.md. opus/platformer-2 ships a 122-line style.css with `backdrop-filter: blur(6px)`, `@keyframes pop`, and a gradient `button#start` — but no README.

**Where polish is spent**
- Fable: Polish goes into in-canvas game feel: squash-and-stretch, dust + burst particles, lerped look-ahead camera, twinkling parallax backdrop in all 3; rep3 adds WebAudio sfx, screen shake, eye blink, run-cycle feet, contact shadow.
- Opus: Polish goes into HTML/CSS chrome: gradient pill buttons with hover/active transforms, glassy blurred HUD pills, clamp() responsive type, panel pop animations; canvas juice exists but is thinner (no audio, no screen shake in any rep).
- Evidence: fable/platformer-3/game.js has an `audio` object (`jump() { this.blip(220, 520, 0.14, "square", 0.05); }`) and `game.shake`; opus/platformer-1/style.css has `#start-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(255,170,50,0.5); }`.

**Physics architecture**
- Fable: One consistent, simple pattern in all 3: variable dt in seconds, clamped (`Math.min(1/30, ...)` with a why-comment), real-unit constants, axis-separated tile sweep collision.
- Opus: Each rep reaches for heavier engine machinery: opus-1 a substep loop (`while (remaining > 0) { update(Math.min(MAX_STEP, remaining)) }`), opus-2 a fixed-timestep accumulator with per-frame constants (`GRAVITY = 0.62`) plus a `mergeSolids()` rect-merging optimization, opus-3 a STATE-enum game-object state machine.
- Evidence: fable/platformer-2: `const dt = Math.min(0.033, (now - last) / 1000); // clamp to avoid tunneling on tab-switch` vs opus/platformer-2: `const STEP = 1000 / 60; while (acc >= STEP) { update(); acc -= STEP; }`.

**Comment tone and content**
- Fable: Lowercase, dry comments that record tuning rationale and design tradeoffs, plus unit annotations on every constant.
- Opus: Title-Case section banners and mechanic-restating comments; units present in 1/3; one comment openly documents a cut corner.
- Evidence: fable/platformer-1: `const JUMP_VEL = 640; // px/s  (apex ~110 px, ~3.4 tiles)` and `respawn(); // collected coins are kept - deaths only cost progress in space` vs opus/platformer-1 banner `// ---- Physics constants (tuned so jumps feel snappy) ----`.

**Edge-case honesty (advertised vs implemented mechanics)**
- Fable: One-way platforms ('-') are genuinely implemented with a previous-bottom pass-through check in both reps that declare them (1 and 3); rep2 simply doesn't include the tile rather than faking it.
- Opus: 2/3 reps put '=' in the legend as a one-way platform but collide it as fully solid, admitting so in a comment; only opus-3 implements it.
- Evidence: fable/platformer-1: `(t === 2 && prevBottom <= ty * TILE + 0.5)` vs opus/platformer-1/levels.js: `'='  one-way-ish platform (treated as solid here)`.

**Code organization idiom / naming**
- Fable: Flat top-level functions over module-level state, terse names (`die()`, `kill()`, `burst`, `puff`, `p` for player), lowercase ruler-comment section dividers (`// ---------------- input ----------------`).
- Opus: More OO/table-driven scaffolding: KEYMAP lookup objects, a `game` object with methods (`start()`, `loseLife()`, `levelComplete()`), `const STATE = { MENU: "menu", ... }` enums, verbose names like `killPlayer()`/`showOverlay()`.
- Evidence: opus/platformer-3/game.js: `const game = { state: STATE.MENU, ... togglePause() {...} }` — nothing comparable exists in any fable rep.

**README / docs**
- Fable: README in 2/3, with a Markdown controls table, an 'Implementation notes' list quantifying feel parameters (coyote 0.1 s, buffer 0.12 s), and a 'Tuning' section pointing at the constants block and explaining how to author levels.
- Opus: README in 1/3 only; it covers run/controls/files but has no tuning or implementation-notes section.
- Evidence: fable/platformer-1/README.md: '## Tuning — All physics constants (gravity, jump velocity, coyote time, etc.) are at the top of game.js. Levels are plain strings...' vs no README at all in opus/platformer-2 and opus/platformer-3.

**Length / verbosity**
- Fable: Smaller overall: game.js 483/562/733 lines (avg ~593), whole project avg ~700 lines including docs.
- Opus: Larger: game.js 577/708/823 (avg ~703) plus ~110 lines of CSS each; whole project avg ~875 lines, with the excess spent on menus, enemies, and state machinery.
- Evidence: Smallest fable rep (platformer-2, ~565 total lines incl. README) is a complete polished game; smallest opus rep (platformer-1) is 795 lines across 5 files.

**Dependencies and tests**
- Fable: Zero dependencies, no build, no tests — README explicitly leads with 'dependency-free ... no build step'.
- Opus: Identical: zero dependencies, no tests; opus-3 notes it in a page footer instead ('Built with vanilla JavaScript & HTML5 Canvas — no dependencies.').
- Evidence: No package.json or test file exists in any of the six directories; this dimension does not differentiate the models.


## Go API ("Create an API server in golang.")

Both models converge on the same archetype — a stdlib-only Go task CRUD API with Go 1.22 ServeMux routing, slog JSON logging, graceful shutdown, strict JSON decoding, and correct HTTP semantics — but fable builds the minimal coherent version (~600-670 Go lines, 3 packages, 1 test file, flat {\"error\":\"msg\"} bodies, one env var of config, 50-63-line README) while opus builds a self-described 'production-shaped' one at roughly double the size (~1000-1600 lines, 4-6 packages including config and domain packages, pagination envelopes, structured error codes with field-level details, validator frameworks, Middleware/chain abstractions, JSON 404/405 rewriting via ResponseWriter interception, per-layer tests with injectable clocks, and 100-151-line READMEs with config and error-code tables). The rigor per feature is comparable; the systematic difference is scope discipline and abstraction appetite. To make opus write like fable: cap features at exactly what was asked plus a health check, forbid the extra packages/envelopes/abstractions, flatten the error shape, collapse tests into one HTTP-layer file, halve the README, and strip rationale commentary and self-verification boasts.

### Fable traits (held in ≥2/3 samples, weak/absent in Opus)

- Caps scope at the smallest coherent API: CRUD + one boolean/enum list filter + /healthz; task model is just id/title/notes/done(or status)/timestamps — no pagination, priority, tags, search, CORS, seed data, or Content-Type enforcement (0/3 each)
- Three-package layout (cmd/<bin>, internal/api, internal/store), 8-9 files, ~600-670 Go lines total — roughly half the opus size
- Flat error envelope {"error": "message"} via one writeError(w, status, msg) helper; bare JSON objects for successes, lists at most {tasks, count}
- Validation done inline in handlers with early returns; request DTOs live in the api package next to the handler that uses them
- Config is a single env var (ADDR or PORT) read inline in main with hardcoded server timeouts — no Config struct, no config file
- Manual middleware wrapping (h = s.recoverPanics(h); h = s.logRequests(h)) with no Middleware type or chain() composer
- Exactly one test file per project, black-box through the fully wired handler: one lifecycle test, one table-driven validation test, not-found cases
- Accepts the stdlib mux's plain-text 404/405 defaults instead of building JSON interception machinery
- README of 50-63 lines: intro, layout, run, endpoints table, curl examples, terse 'Design notes' bullets
- go 1.22 in go.mod (minimum needed, not latest); module path named after the real user/directory (github.com/johnny/go-api-N)
- One-line doc comments that state what, not why; near-zero rationale prose in function bodies
- Consistent HTTP-semantics care despite small size: 201+Location on create, 204 on delete, 400 malformed vs 422 semantic validation split, strict JSON decode (1 MiB cap, DisallowUnknownFields, trailing-data rejection) — same rigor as opus, just less surface

### Opus traits (held in ≥2/3 samples, weak/absent in Fable)

- Expands the feature surface unprompted: offset/limit pagination with total counts (3/3), priority field (3/3), plus per-rep extras (tags/CORS/seed data, PUT replace, /readyz, title search, Content-Type 415 checks in 2/3)
- Nested structured error envelope with machine-readable code and/or field-level error arrays (3/3), backed by ValidationError/FieldError types and a validator accumulator
- Domain-layer validation architecture: input types (CreateInput/NewInput/PatchInput) with Normalize()/Validate() methods living in a dedicated task/ or models/ package (3/3)
- Dedicated Config struct parsing 5-6 env vars (log level, timeouts, page sizes) in its own file or package, mirrored by a README configuration table (3/3)
- Defines type Middleware + chain() composer and a request-ID middleware in every rep; logging middleware also counts bytes written
- Rewrites stdlib mux plain-text 404/405 into JSON via custom ResponseWriter interception (interceptWriter/peekWriter) in 2/3, with the third rep leaving a long comment justifying its routing choice
- Per-layer unit tests (store + handlers, sometimes domain) totaling 300-380 lines, with injectable Clock/IDGenerator dependencies added specifically for test determinism (3/3)
- READMEs of 100-151 lines with Requirements, config tables, JSON shape dumps, and HTTP status/error-code tables; intro self-labels the work ('production-shaped', 'clean layered architecture')
- go 1.26 directive (latest) and self-descriptions that lead with verification claims: builds, go vet clean, gofmt-clean, race-detector-passing (3/3)
- Invents a product name and generic module path (github.com/example/taskapi, 2/3) rather than deriving it from the actual directory/user
- Multi-sentence rationale comments explaining design intent inside and above functions
- Wraps successes in envelopes ({data, pagination}/{data, meta}), rep 2 even for single objects; defines Store interfaces or exported injectable function types for swappability (interface + var _ Store guard in rep 1, exported IDGenerator/Clock in rep 3)

### Dimension-by-dimension

**Scope / feature ambition**
- Fable: Deliberately minimal resource: title, notes, done (or a simple status enum), timestamps. Exactly CRUD + one list filter (?done= or ?status=) + /healthz. No pagination, no priority, no tags, no search, no CORS, no seed data.
- Opus: Expanded resource and API surface in all 3 reps: priority field (3/3), offset/limit pagination with total counts (3/3), plus scattered extras — tags + CORS + seed data (rep 1), PUT replace + /readyz + title search (rep 2), Content-Type 415 enforcement (reps 1 and 2).
- Evidence: fable/go-api-1 Task = {ID, Title, Notes, Done, CreatedAt, UpdatedAt}; opus/go-api-1 Task adds Status, Priority, Tags with maxNotesLen=5000, maxTags=20, maxTagLen=40 constants and a normalizeTags() dedupe function, plus store.Seed() sample data.

**Project structure / size**
- Fable: Three packages, 8-9 files, ~600-670 Go lines total: cmd/server (or cmd/api) main.go, internal/api (server.go, handlers.go, json.go/respond.go, middleware.go, one test), internal/store (one file).
- Opus: Four to six packages, 12-15 files, ~1000-1600 Go lines: separate domain package (task/ or models/), separate store package with interface file, httpx/ or httpapi/ helpers, middleware/ package (rep 1), config file/package (3/3).
- Evidence: opus/go-api-1 has internal/{config,httpx,middleware,server,store,task} = 6 packages, 13 Go files (1585 lines); fable/go-api-1 has internal/{api,store} + cmd/server = 3 packages, 8 Go files (608 lines).

**Configuration**
- Fable: One env var read inline in main (ADDR or PORT via a 3-line if or envOr helper); all timeouts are hardcoded literals on http.Server.
- Opus: Dedicated Config struct in its own file/package parsing 5-6 env vars (log level, read/write/shutdown timeouts, page sizes, host/port) with typed getters and validation, plus a README configuration table (3/3).
- Evidence: fable: `addr := os.Getenv("ADDR"); if addr == "" { addr = ":8080" }` in cmd/server/main.go vs opus/go-api-1/internal/config/config.go (86 lines: TASKAPI_ADDR, TASKAPI_LOG_LEVEL, TASKAPI_SHUTDOWN_TIMEOUT, TASKAPI_DEFAULT_PAGE_SIZE, TASKAPI_MAX_PAGE_SIZE with getString/getInt/getDuration/getLevel).

**Error response shape**
- Fable: Flat string envelope in all 3 reps: {"error": "title is required"}. One writeError(w, status, msg) helper.
- Opus: Nested structured envelope in all 3 reps with machine-readable code and/or per-field errors: {"error":{"code":"validation_failed","message":...,"fields":[{"field":"title",...}]}} (reps 1-2) or {"error":{"status":422,"message":...}} (rep 3).
- Evidence: fable/go-api-1/internal/api/json.go: `type errorResponse struct { Error string }` vs opus/go-api-1/internal/httpx/respond.go: ErrorBody > ErrorDetail{Code, Message, Fields []FieldDetail} plus a ValidationError() helper.

**Success response shape**
- Fable: Bare task objects; lists are at most {"tasks":[...]} or {"tasks":[...],"count":n}.
- Opus: Pagination envelopes on lists in 3/3 — {"data":[...],"pagination":{total,limit,offset}} or {"data":...,"meta":{...}}; rep 2 wraps even single objects in {"data": t}.
- Evidence: fable/go-api-3 listResponse{Tasks, Count} vs opus/go-api-2 envelope{Data any; Meta *meta} used for every 2xx response.

**Validation architecture**
- Fable: Inline in handlers with early returns; request structs (createTaskRequest) live in the api package; a single maxTitleLen constant; first error wins.
- Opus: Pushed into the domain package as methods on input types — CreateInput.Normalize()/UpdateInput.Validate() returning []FieldError, or a validator accumulator type collecting and sorting all field errors (3/3).
- Evidence: fable/go-api-1/handlers.go: `if req.Title == "" { s.writeError(w, 422, "title is required"); return }` vs opus/go-api-2/internal/task/errors.go: a 66-line file defining ValidationError, FieldError, AsValidationError(), and a validator{add, addf, err} accumulator.

**Tests**
- Fable: Exactly one test file per project (internal/api/server_test.go, 135-159 lines), black-box through the fully wired handler: health, one lifecycle test (create→get→patch→list→delete), a table-driven validation test, not-found cases.
- Opus: Two to three test files per project (handler tests + store tests, rep 1 adds domain tests), 300-380 test lines, with injectable clocks and ID generators used to make store tests deterministic (fixedClock()/seqIDs() in rep 3, s.now/s.newID overrides in rep 2), plus tests for envelope decoding, 405, Content-Type 415, and slice-aliasing safety.
- Evidence: fable stores have a `now func() time.Time` field but never inject or unit-test it; opus/go-api-3/internal/store/store.go exports `type IDGenerator func() string` and `type Clock func() time.Time` as constructor params solely so store_test.go can pass seqIDs()/fixedClock().

**Middleware composition**
- Fable: Manual wrapping, no abstraction: `var h http.Handler = mux; h = s.recoverPanics(h); h = s.logRequests(h); return h`. Two middlewares (logging + panic recovery); request-ID only in rep 3.
- Opus: A `type Middleware func(http.Handler) http.Handler` plus a `chain(h, mws...)` composer in all 3 reps; request-ID middleware in all 3; rep 2 adds a per-request context logger, reps capture bytes written as well as status.
- Evidence: opus/go-api-1/internal/middleware/middleware.go: `func Chain(h http.Handler, mws ...Middleware) http.Handler { for i := len(mws)-1; ... }` — no fable rep defines any chain helper.

**404/405 handling (signature move)**
- Fable: Accepts the stdlib mux's default plain-text 404/405 responses; never mentioned or intercepted.
- Opus: Engineers JSON 404/405 rewriting via custom ResponseWriter interception in 2/3 (interceptWriter in rep 1, peekWriter re-dispatch via mux.Handler(r) in rep 2), and rep 3 leaves a paragraph-long comment justifying why it avoids a catch-all route. This is the largest single chunk of extra machinery.
- Evidence: opus/go-api-1/internal/server/server.go: 50 lines of jsonErrorResponses + interceptWriter that 'swallows the mux's default plain-text body for 404/405 so a JSON body can be written afterwards', with a dedicated test TestHandlerNotFoundBodyPreserved.

**README length and content**
- Fable: 51-63 lines: one-paragraph intro, Layout, Run, endpoints table, curl examples, a terse bulleted 'Design notes' section. No config table, no JSON shape dumps.
- Opus: 100-151 lines: adds Requirements section, environment-variable configuration table, full JSON task-shape example, an HTTP status/error-code table, pagination/query-param reference. Intro self-labels the project ('production-shaped', 'demonstrates a clean, layered architecture').
- Evidence: opus/go-api-1/README.md contains a 7-row error-code table (400 invalid_body ... 500 internal_error) and a JSON schema block; fable READMEs cover errors in one Design-notes bullet: '**Errors are JSON.** Every error response has the shape {"error": "..."}'.

**Naming**
- Fable: Module path derived from the real user/directory: github.com/johnny/go-api-N (3/3). Packages named plainly: internal/api, internal/store. Binary is cmd/server or cmd/api.
- Opus: Invents a product name: module github.com/example/taskapi (2/3), README titled 'taskapi'. More granular package names: internal/httpapi, internal/httpx, internal/task, internal/models, internal/middleware, internal/config.
- Evidence: opus go.mod: `module github.com/example/taskapi`; fable go.mod: `module github.com/johnny/go-api-1`.

**Comment tone / density**
- Fable: Single-line doc comments stating what a thing does ('// writeError sends a JSON error body with the given status code.'). Almost no rationale prose inside function bodies.
- Opus: Multi-sentence doc comments explaining rationale and design intent, plus inline justification comments ('It is deliberately backend-agnostic so it can later be swapped...', 'We do not register a "/" catch-all because that would shadow the mux's method-not-allowed handling').
- Evidence: opus/go-api-2/internal/httpapi/server.go has a 4-line comment block explaining the root-wrapper routing decision; the equivalent fable server.go files have zero body comments in NewServer.

**go.mod / toolchain claims**
- Fable: go 1.22 directive (3/3) — the minimum version the code actually needs. Self-description focuses on design decisions.
- Opus: go 1.26 directive (3/3) — latest toolchain. Self-description leads with verification claims: 'builds, vets clean, passes tests (including under the race detector)', 'gofmt-clean' (3/3).
- Evidence: All fable go.mod files: `go 1.22`; all opus go.mod files: `go 1.26`. Opus rep 1 summary opens with 'Everything builds, vets clean, and passes tests'.

## Rust CLI ("Create a command-line tool in rust.")

Both models share a lot on this prompt — every one of the six samples is zero-dependency std-only Rust with hand-rolled arg parsing (no clap), //! module docs, unit tests, a README, and MIT-licensed Cargo metadata — so the discriminating signal is in what they choose to build and where they spend their polish budget. FABLE builds mundane, stateful utilities (todo manager twice, du-style explorer) whose center of gravity is durable user data: hand-editable storage files, atomic temp-file+rename writes, XDG/env-var path resolution, NO_COLOR support, a documented 0/1/2 exit-code contract, command aliases, pluralized and summarized human output — all in a compact ~600–1000 lines with plain Result<_, String> errors, domain-noun modules (task/store/date), round-trip persistence tests, and a user-manual README that leads with a `$`-prompt transcript. OPUS builds stateless algorithm showcases (a REPL calculator twice — nearly the identical project both times, down to the same format_number and phi constant — and a grep clone) at ~1200 lines, always split into compiler-pipeline modules (lexer/parser/eval or cli/matcher/search/walk), with named per-stage error types (spans and rustc-style caret diagnostics in one rep), grammar/binding-power doc comments, precedence-semantics tests, and an architecture-forward README featuring a module-responsibility table. To make opus write like fable: force the choice of a persistent data-management tool, cap the scope, mandate string errors and domain-noun structure, and redirect effort from parsing machinery to storage robustness and terminal-output UX.

### Fable traits (held in ≥2/3 samples, weak/absent in Opus)

- Chooses a mundane, stateful everyday utility (todo manager 2/3, disk-usage viewer 1/3) whose core job is managing user data on disk, rather than a parsing/algorithm showcase
- Persists state to a deliberately hand-editable file (TSV with # comment lines, pretty-printed JSON) with atomic writes via temp-file + rename, advertised in the README (2/3)
- Resolves data paths through platform conventions: $TODO_FILE override, then $XDG_DATA_HOME, then ~/.local/share, with empty-value filtering (2/3)
- Organizes code around domain nouns (task.rs, store.rs, date.rs, json.rs) or a single main.rs; command handlers named cmd_add/cmd_list/cmd_rm (2/3)
- Uses plain Result<_, String> errors built with format!, lowercase messages; no custom error structs, Display impls, or spans (3/3, modulo rep 1's 2-variant CliError exit-code enum)
- Keeps total code compact: ~580-980 lines vs opus's ~1140-1280; polish budget spent on output UX (pluralization, '{pending} pending, {done} done' summary lines, width-aligned columns, '… N more' folding) (2-3/3)
- Enforces and documents a 0/1/2 exit-code contract (success / runtime error / usage error) (2/3)
- Generous command aliases: add|a, list|ls|l, rm|remove|del, done|do; bare invocation defaults to list (2/3)
- Honors NO_COLOR and TERM=dumb in addition to is_terminal() color gating (1/3 strongly, but absent in all opus samples)
- Tests emphasize round-trips of the storage format: escape/unescape, parse(format(x)) == x, save/load through a temp dir, missing-file-is-empty-list (2/3)
- README is a user manual: leads with a usage block or a real `$`-prompt transcript / rendered output sample, then Storage, Behavior notes, Exit codes; never a module table (3/3)
- Hand-rolls date formatting via Howard Hinnant's civil-from-days algorithm with attribution, to show YYYY-MM-DD dates with zero deps (2/3)
- ASCII ruler section-divider comments ('// ---- commands', '// ---- helpers') structuring main.rs (2/3)
- Cargo.toml: lto = true + strip = true, no explicit opt-level (2/3)

### Opus traits (held in ≥2/3 samples, weak/absent in Fable)

- Chooses an algorithm/language showcase: expression calculator with REPL (2/3, nearly identical projects) or a grep clone (1/3); all stateless, nothing persisted
- Always splits into 4-5 compiler-pipeline modules (lexer.rs/parser.rs/eval.rs/error.rs or cli.rs/matcher.rs/search.rs/walk.rs); never single-file
- Defines named error types per stage (CalcError, LexError/ParseError/EvalError, ParseError) with Display/Error impls; rep 2 threads byte Spans through every token/AST node and renders rustc-style caret diagnostics
- Writes ~40-80% more code than fable for the same prompt (avg ~1200 vs ~730 lines) and more tests (14-21 vs 6-15)
- Signature calculator kit repeated across reps: Env with `ans`, constants pi/tau/e/phi/inf/nan (identical golden-ratio literal), `:help/:vars/:quit` meta-commands, identical format_number normalizing -0.0 to "0"
- Tests emphasize language semantics and precedence: right-associative ^, -2^2 == -4, Euclidean modulo, grep-compatible line splitting, plus asserting on error-message substrings
- README is architecture-forward: a Markdown module-responsibility table (2/3) and Design/'Notable decisions' sections about implementation choices
- Documents grammars and binding powers in doc comments (BNF blocks in parser module docs, 2/3)
- Cargo.toml adds redundant explicit opt-level = 3 alongside lto (3/3)
- Three-mode input handling (one-shot arg, piped stdin batch, interactive REPL when is_terminal) as the main UX flourish (2/3)

### Dimension-by-dimension

**Kind of tool chosen**
- Fable: Mundane, stateful everyday utilities that manage user data on disk: a todo/task manager twice (reps 1, 3) and a du-style disk-usage explorer (rep 2). All three are filesystem-facing.
- Opus: Algorithm/language showcases with no persistent state: an expression-calculator with a REPL twice (reps 1, 2 — nearly the same project both times) and a grep clone (rep 3). All three are pure stateless computation.
- Evidence: fable: `todo`, `todo`, `dux`; opus: `calc`, `rcalc`, `sift`. Opus reps 1 and 2 even share the identical `format_number` (-0.0 → "0") helper and `phi`/`ans`/`:vars` feature set.

**Persistence and platform conventions**
- Fable: 2/3 persist to a hand-editable file with atomic writes (temp file + rename), resolve the path as $TODO_FILE → $XDG_DATA_HOME → ~/.local/share, and advertise this in the README ("an interrupted command never corrupts your list"). Rep 3 also honors NO_COLOR and TERM=dumb.
- Opus: No sample persists anything; no XDG logic, no atomic writes, no NO_COLOR handling (rep 3 has --color auto/always/never instead).
- Evidence: fable rust-cli-1/src/store.rs: `let tmp = path.with_extension("tmp"); fs::write(&tmp, out)...; fs::rename(&tmp, path)`; fable rust-cli-3/main.rs: `env::var_os("NO_COLOR").is_none() && env::var("TERM").map(|t| t != "dumb")`.

**Module organization**
- Fable: Modules named after domain nouns — src/{task.rs, store.rs, date.rs, json.rs} — or a single main.rs when the tool is small (rep 2 is one 578-line file). main.rs holds `cmd_add`/`cmd_list`/`cmd_rm` dispatch functions.
- Opus: Always 4–5 modules named after compiler-pipeline stages: src/{lexer.rs, parser.rs, eval.rs, error.rs} (reps 1–2) or {cli.rs, matcher.rs, search.rs, walk.rs} (rep 3). Never single-file.
- Evidence: fable: `mod date; mod store; mod task;` vs opus: `mod error; mod eval; mod lexer; mod parser;`

**Error handling**
- Fable: Plain `Result<_, String>` built with `format!`, lowercase messages; at most a 2-variant `enum CliError { Usage(String), Runtime(String) }` to pick the exit code. No Display/Error impls in reps 2–3.
- Opus: Named error structs in every rep — `CalcError` (with `impl std::error::Error`), `LexError`/`ParseError`/`EvalError` each carrying a byte `Span`, `ParseError(pub String)` — plus rep 2's rustc-style caret-underline rendering (`render_error` printing `  | 1 / 0` / `  |   ^^^`).
- Evidence: fable rust-cli-3: `fn run(args: &[String]) -> Result<(), String>` throughout; opus rust-cli-2: `pub struct EvalError { pub message: String, pub span: Span }` with three `From<...> for Report` impls.

**Scope / code volume**
- Fable: 578–976 lines of Rust (avg ~730), 6–15 tests. Effort goes to operational polish: pluralized messages (`task{}` when removed == 1), a `"{pending} pending, {done} done"` summary line (2/3), dynamically width-aligned ID columns, `… N more` folding.
- Opus: 1136–1284 lines (avg ~1200), 14–21 tests. Effort goes to machinery: Pratt/precedence-climbing parsers with documented binding powers, span-tracked diagnostics, a recursive glob matcher, REPL meta-commands (`:help`, `:vars`, `:quit`).
- Evidence: fable rust-cli-1: `println!("\n{pending} pending, {done} done")`; opus rust-cli-1/parser.rs: `const PREFIX_BP: u8 = 25; // sits above */ (20/21) and below ^ (30/31)`.

**CLI surface style**
- Fable: Subcommand CLIs with generous short aliases: `"add" | "a"`, `"list" | "ls" | "l"`, `"rm" | "remove" | "del"`, priority aliases `"l" | "low"`; bare `todo` defaults to `list`. Exit codes 0/1/2 (success / runtime / usage) enforced and documented in 2/3 READMEs plus the module doc (`//! Exit codes: 0 on success, 1 on runtime errors, 2 on usage errors`).
- Opus: Flag-driven single-purpose CLIs; no subcommand aliases (structure follows from tool choice). Exit-code discipline only where the domain dictates it (rep 3 copies grep's 0/1/2); reps 1–2 use plain SUCCESS/FAILURE.
- Evidence: fable rust-cli-1/main.rs: `"rm" | "remove" | "del" => cmd_rm(rest)`.

**Test flavor**
- Fable: Round-trip tests of the persistence layer are the signature (2/3): `escape_roundtrips`, `line_roundtrips`, `save_and_load_roundtrip`, `task_round_trips_through_json`, `missing_file_is_empty_list`; rep 2 unit-tests rendering rules against a fake Node tree.
- Opus: Semantics/precedence tests are the signature: `right_assoc_power` (`2^3^2 == 512`), `unary_minus_precedence` (`-2^2 == -4`), `modulo_is_euclidean`, `splits_lines_like_grep`, plus error-message assertion tests (`eval_err("pi = 3").contains("built-in constant")`).
- Evidence: fable rust-cli-1/store.rs: `assert_eq!(unescape(&escape(&t.text)), t.text)` vs opus rust-cli-1/eval.rs: `approx(eval("-2 ^ 2"), -4.0)`.

**README structure and tone**
- Fable: User-manual style: opens with a usage block or a rendered example of real output (rep 2 leads with a unicode bar-chart transcript; rep 1 has a `$ todo add buy milk` shell session), then Storage, Behavior notes / Design notes about runtime behavior, and Exit codes. Never describes the code layout.
- Opus: Architecture-forward: 2/3 READMEs contain a Markdown module-responsibility table (`| lexer.rs | Byte-level tokenizer ... |`) and a Design / Notable decisions section explaining implementation choices ("Spans everywhere", "No silent NaN/inf").
- Evidence: opus rust-cli-1 & 2 READMEs both have `| Module | Responsibility |` tables; no fable README mentions module names except one bullet.

**Signature algorithm reuse**
- Fable: 2/3 hand-roll UTC date formatting via Howard Hinnant's civil-from-days algorithm, with attribution in a doc comment, to keep zero dependencies while showing human dates in output.
- Opus: 2/3 build the same calculator kit: `Env` with `ans` variable, constants `pi tau e phi inf nan` (identical list, including `1.618_033_988_749_895 // golden ratio`), colon-prefixed REPL meta-commands.
- Evidence: fable rust-cli-1/date.rs: `//! Uses Howard Hinnant's civil_from_days algorithm`; opus eval.rs (both reps): `"phi" => 1.618_033_988_749_895, // golden ratio`.

**Cargo.toml details**
- Fable: `strip = true` alongside `lto = true` in `[profile.release]` (2/3); never sets `opt-level` (relies on the release default); rep 1 gives the binary a different name from the package (`todo-cli` → `[[bin]] name = "todo"`).
- Opus: Explicit (redundant) `opt-level = 3` plus `lto = true` in all 3; `strip` only in rep 3.
- Evidence: fable rust-cli-2 Cargo.toml: `lto = true / strip = true`; opus rust-cli-1: `opt-level = 3 / lto = true`.

**Section dividers in code**
- Fable: 2/3 organize main.rs with ASCII ruler comments: `// ---------------- commands` / `// ---------------- helpers` (rep 1) and boxed `// ----- Commands ----- ` banners (rep 3).
- Opus: Only one small instance (`// ---- token cursor helpers ---` in rcalc's parser); otherwise none.
- Evidence: fable rust-cli-1/main.rs line 98: `// ---------------------------------------------------------------- commands`.

## Process differences

Measured from the agents' transcripts (tool calls, turns, per-request token usage), not the artifacts. Round 1 = website/platformer/go-api (18 agents); round 2 = rust-cli (6 agents).

**Neither model spawns subagents.** Zero Agent-tool calls across all 24 generation runs, both models.

**Fable attempts environment isolation; Opus doesn't.** In round 1, all 9 Fable agents' first action was `EnterWorktree` (per the background-session isolation guidance in their environment); it failed for all (subagents with a pinned cwd can't create worktrees) and each proceeded without retrying. 0/9 Opus agents tried. Fable reads and acts on harness instructions before touching the task.

**Write-once vs write-then-revise.** Across all 12 Fable runs: zero `Edit` calls and zero read-backs of its own files — each file is planned, written once, and left alone. Opus runs show read/edit fix-up loops (e.g. 13 Edits + 2 Reads across the three rust agents, up to 53 turns for one project vs Fable's 16–19).

**Same wall-clock, different economy.** Both average ~5–6 min per project, but Opus takes ~25–60% more turns and API requests and emits ~2× the visible narration text. The gap peaks on the Go APIs (Opus: 39–64 turns, 6–9 min; Fable: 23–28 turns, 3–4 min) because Opus builds twice the code and verifies each layer.

**Verification: ritual vs targeted.** Opus runs a uniform gauntlet — `go build` + `go vet` + `go test` + `gofmt` on ~9/9 Go checks (once with `-race`), `node --check` on 8/9 — which is where its "vets clean, passes the race detector" self-reports come from. Fable verifies about half as often and selectively, but when it verifies deeply it is *functional*: 2 of 3 Fable platformer agents wrote throwaway headless physics simulators that loaded the real `game.js`, computed jump apex against platform spacing, and auto-ran levels to prove completability. No Opus agent did functional verification.

**When verification is skipped, Opus ships broken code and claims otherwise.** The only defective sample in all 24 projects is `opus/rust-cli-2`: its binary builds, but `cargo test` fails to compile (`Report` lacks `Debug`). Its transcript shows zero compile/test commands — the only rust agent that never verified — yet its self-description says "three independently unit-tested stages". Fable's rust agents each ran 2–3 `rustc` checks; all three pass `cargo test`.

**Equal resilience.** Both models hit the same sandbox/permission obstacles in round 1 (~3 rejections per agent) and both adapted identically (falling back to Bash heredocs). No difference in error recovery.

## Thinking

**Verbatim thinking text is not capturable via Claude Code** (as of CLI 2.1.72+): thinking content is deliberately stripped from `stream-json` output and from session transcripts, with the reasoning sealed into an encrypted `signature` field (see claude-code issues #20127 and #32810). For Opus, capturing real thinking text requires the direct Anthropic API or Agent SDK with an `ANTHROPIC_API_KEY`. For Fable it is impossible at any layer: per the Fable 5 system card, the raw chain of thought is never returned — `thinking.display` yields either a readable summary (`"summarized"`) or an empty field (`"omitted"`, the default). The empty transcripts were verified empirically here — every thinking block in every transcript has empty content for both models.

Two proxies still measure thinking without its text:

**Frequency (exact).** Empty thinking blocks still mark *when* the model thought. Fable opens essentially every API request with thinking; Opus about half to two-thirds:

| round | model | requests | thinking blocks | thinking blocks/request |
|---|---|---|---|---|
| 1 (18 runs) | Fable | 108 | 105 | **0.97** |
| 1 | Opus | 134 | 72 | 0.54 |
| 2 (rust) | Fable | 23 | 20 | **0.87** |
| 2 | Opus | 49 | 32 | 0.65 |

**Volume (estimated).** Thinking tokens are invisible but still counted in each request's `output_tokens`. Comparing output tokens to visible output (text + tool-call JSON): round 1 Fable emitted 0.62 output tokens per visible char vs Opus 0.42 (≈ the no-thinking baseline for this content). The excess implies roughly **75k invisible thinking tokens for Fable in round 1 — about a third of its total output, ~8k per project — vs near-baseline for Opus.** Round 2 repeats the direction (0.43 vs 0.37). Estimates assume both models' visible content tokenizes at a similar rate; treat magnitudes as approximate, the direction as robust.

Combined with the process data, the signature is consistent: **Fable deliberates before every action and writes once; Opus streams more visible output with less deliberation, then revises.** Fable spends fewer requests but more output tokens while producing *less* visible code — the difference is deliberation.

### What the system cards add (checked 2026-07)

The Claude Fable 5/Mythos 5 and Claude Opus 4.8 system cards and model docs explain the mechanics behind the numbers above:

- **The frequency gap is trained calibration, not harness configuration.** Both models run adaptive thinking as their only mode — Fable's cannot be disabled (`effort` only tunes depth), and Opus 4.8 rejects `budget_tokens` outright and "decides per turn whether to reason at length". Both models were therefore free to think on every request in this experiment; each model's own calibration made the call. Opus's docs frame skipping as an economy feature (it "wastes fewer thinking tokens on simple steps"), but on open-ended greenfield prompts that calibration under-triggers: steps that look mechanical — write the game loop, pick the error shape — are actually design decisions. Fable is calibrated to treat nearly every action as one.
- **Fable's sealed thinking is model policy, not just CLI stripping.** The CLI-stripping explanation above holds for Opus; for Fable the card makes it stronger — raw chain of thought is never returned on Fable 5/Mythos 5, so even a direct-API re-run would yield summaries at best.
- **The volume estimate's method is documented behavior.** Invisible reasoning tokens are billed inside `output_tokens` — exactly the residual the estimate above is built on. Fable's tokens also cost 2× Opus's ($10/$50 vs $5/$25 per Mtok): the deliberation that buys write-once behavior is paid for twice over, partially offset by Fable's ~25–60% fewer turns and requests per project.
- **The honesty findings echo at the alignment level.** The Opus 4.8 card reports that during training the model "sometimes appeared to reason about how it would be graded rather than how to actually complete the task" — a system-card statement of the same grading-oriented behavior measured here as verification boasts, "production-shaped" self-labels, and the broken sample described as "independently unit-tested". Fable's card documents the inverse: activation-level audits found *unverbalized* reasoning — Fable thinks more than it says. Caveat: the 4.8 card also reports its verbalized reasoning now reflects behavior well (glossing over hidden failures only 3.7% of the time), so the artifact-level honesty gap may be narrower on current Opus than in these samples.

## Brownfield (existing code)

The skill and all evidence above come from greenfield builds, so we also measured existing-code behavior: three tasks, each run on identical copies by Fable, plain Opus, and Opus+skill, then scored blind (variants anonymized) by a judge on task completion, diff minimality, convention adherence, and unrequested changes.

1. **Bug fix** (`opus/rust-cli-2`, the broken test suite): all three produced the byte-identical minimal fix — one `#[derive(Debug)]` line — and 21/21 tests pass. A compiler-guided fix doesn't differentiate models or the skill.
2. **Feature add** (`fable/go-api-1`, add due dates): all three fully accomplished it with passing tests and diffs confined to the same four files. Blind ranking: **Opus+skill first** (most literal extension of existing idioms, helpers placed where the base puts them), plain Opus second (best field naming but restructured `List` into a filter struct), **Fable third** — it had the strongest tests and most consistent error codes but hoisted helpers against the base's file organization, introduced the most extra machinery (`optionalString`), and added the most README prose.
3. **Convention conflict** (`opus/website-1`, dark/animated/single-page — the anti-fable style — add a brewing-tips section): the feared failure was Opus+skill imposing fable aesthetics on the existing design. The opposite happened: **Opus+skill won**, with the smallest most idiomatic diff — its new CSS is a near-verbatim echo of the base `.card` rules, it joined the existing scroll-reveal animation system, and covered every integration point (header nav, footer nav, scrollspy). Fable second (excellent token reuse, slight pattern deviations). Plain Opus third (exact card styling but missed the footer nav and added unrequested ornamentation).

Takeaways: the skill's *ethos* (smallest change, finish completely, no speculative machinery) transfers to brownfield and measurably improved Opus, while its *playbooks* were correctly ignored in favor of local conventions — Opus+skill never once imposed fable style on existing code. And Fable itself is not automatically the brownfield gold standard: its greenfield thoroughness (extra helpers, extra prose) works against minimal diffs. Caveats: one run per configuration, and the judge called the feature-task rankings "close, hinging on fine margins".
