# Feature Flow: Marginalia Books

## Kind

Website; plain HTML, CSS and JavaScript, no build step, no external network requests.

## Checks

- Full: `NODE_PATH=$(npm root -g) node tests/run.js` (headless Chromium via the globally installed Playwright, serves the repo from a local static server)
- Targeted: same command; `node tests/run.js <name-filter>` runs matching tests only
- Run it: `python3 -m http.server 8000` at the repo root, open http://localhost:8000/

## Conventions

- New page: own .html file at repo root, shared nav/header/footer markup copied identically, `aria-current="page"` on its nav link, linked from every page's nav, test in tests/run.js.

## Standing criteria

- 360px wide without sideways scrolling on every page.
- Filter, sort or search state lives in the URL.
- No requests to any origin other than the page's own.

## Reviewer checklist

- Keyboard navigation and visible focus; 360px width without sideways scrolling, also with text enlarged to 200%; form labels and errors; nothing decorative that looks interactive.
- Filter state lives in the URL so a result can be bookmarked and shared.
- A form submits somewhere real or says plainly that it's a demo; it never claims a message was sent when nothing was.
- Content real enough to judge the design: no lorem ipsum, no placeholder sections, lists long enough to need their filter.
- Tests load pages in a headless browser; a test that only reads the source doesn't count.
