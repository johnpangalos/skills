# Feature Flow: Marginalia Books

## Kind

website; plain HTML, CSS and JavaScript, no build step, no external network requests.

## Checks

- Full: `node tests/run.mjs` (headless Chrome via Playwright: loads each page from a local static server, checks nav, filter, form, 360px overflow, no external requests, axe-free a11y basics)
- Targeted: `node tests/run.mjs <page>` (e.g. `books`)
- Run it: `python3 -m http.server 8000` at the repo root, open http://localhost:8000/

## Conventions

- New page: own .html at the root, shared header/nav/footer markup copied identically, `aria-current="page"` on its nav link, shared `css/style.css`, per-page script in `js/`.

## Standing criteria

- 360px wide without sideways scrolling.
- Filter, sort or search state lives in the URL.
- No requests to any host other than the page's own origin.

## Reviewer checklist

- Keyboard navigation and visible focus; skip link; landmarks and headings in order.
- 360px width without sideways scrolling.
- Form labels and errors; form says plainly it is a demo and never claims a message was sent.
- Nothing decorative that looks interactive.
- Filter state in the URL; back/forward and a bookmarked URL restore it; unknown genre handled.
- Content real enough to judge: no lorem ipsum, catalog long enough to need its filter.
- Tests load pages in a headless browser; source-reading tests don't count.
