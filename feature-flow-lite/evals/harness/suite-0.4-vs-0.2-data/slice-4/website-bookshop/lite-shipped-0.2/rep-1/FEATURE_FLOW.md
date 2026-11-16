# Feature Flow: Marginalia Books

## Kind

website; plain HTML, CSS and JavaScript, no build step, no external network requests.

## Checks

- Full: `NODE_PATH=$(npm root -g) node --test tests/*.test.js` (Node 22 rejects a bare directory argument; headless Chrome via the globally installed Playwright, page served by a tiny Node static server inside the tests)
- Full: `for f in js/*.js; do node --check "$f" || exit 1; done` (syntax check of every script)
- Targeted: `NODE_PATH=$(npm root -g) node --test tests/<file>.test.js`
- Run it: `npx --no-install http-server -p 8080 .` then open http://localhost:8080/ (Chrome at /usr/bin/google-chrome)

## Conventions

- New page: its own `.html` at the repo root, the shared nav and footer markup copied exactly with `aria-current="page"` on its own link, shared `css/styles.css`, page script in `js/`, a test in `tests/`.
- No CDNs, web fonts or any external URL in `src`/`href`/`url()`; system font stacks only.

## Standing criteria

- Usable at 360px wide with no sideways scrolling.
- Filter, sort or search state lives in the URL (query string), and loading that URL restores it.
- No requests leave the local origin.
- Accessible: semantic landmarks, skip link, one `h1` per page, visible focus, labelled form controls, WCAG AA contrast, live-region announcements for dynamic results.

## Reviewer checklist

- Keyboard navigation and visible focus; 360px width without sideways scrolling; form labels and errors; nothing decorative that looks interactive.
- Filter, sort or search state lives in the URL so a result can be bookmarked and shared.
- A form submits somewhere real or says plainly that it's a demo; it never claims a message was sent when nothing was.
- Content is real enough to judge the design: no lorem ipsum, no one-line placeholder sections, lists long enough to need their filter.
- Tests that prove these load the page in a headless browser; a test that only reads the source doesn't count.
- Every request the pages make stays on the local origin (check in the browser's network log).
- Facts repeated across pages agree (opening hours on home/visit vs. event times on events; address in footer vs. visit).
