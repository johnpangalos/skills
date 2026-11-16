# Feature Flow: Marginalia Books website

## Kind

website; static plain HTML, CSS and JavaScript, no build step, no external network requests
(no CDNs, no web fonts). JavaScript is required (no no-JS fallback needed).

## Checks

- Full: `NODE_PATH=$(npm root -g) node --test tests/*.test.js` (Node 22 does not accept a bare directory)
- Full: `npx --no-install prettier --check "**/*.{html,css,js,mjs,md}"`
- Targeted: `NODE_PATH=$(npm root -g) node --test tests/<file>.test.js`
- Run it: `npx --no-install http-server -p 8080 -s .` then open http://localhost:8080/ (tests
  start their own static server and drive /usr/bin/google-chrome through the global
  Playwright install)

## Conventions

- New page: its own `.html` at the repo root, the shared `<header>`/nav and footer copied
  verbatim with `aria-current="page"` on its own link, linked from every other page's nav,
  and covered in `tests/` (loads with no console errors, no external requests, 360px width).
- Shared styles in `css/styles.css`, shared script in `js/`; data such as the book catalog
  lives in one JS module, not duplicated in markup.

## Standing criteria

- Every page renders at 360px wide with no sideways scrolling.
- Filter, sort or search state lives in the URL (query string) so a result can be bookmarked
  and shared, and the back button restores it.
- No request leaves the origin (no CDN, font, image or analytics URLs).
- No console errors on any page.

## Reviewer checklist

- Keyboard navigation and visible focus on every interactive element; skip link works.
- 360px width without sideways scrolling, on every page, also with root text at 200% (grid
  minimums use `min(<size>, 100%)`).
- Form labels and errors: every field has a label, errors are announced and tied to their
  field with `aria-describedby`, focus moves to the first invalid field.
- Nothing decorative that looks interactive.
- Filter state lives in the URL so a result can be bookmarked and shared; an unknown value in
  the URL doesn't break the page.
- A form submits somewhere real or says plainly that it's a demo; it never claims a message
  was sent when nothing was.
- Content is real enough to judge the design: no lorem ipsum, no one-line placeholder
  sections, lists long enough to need their filter.
- Tests that prove these load the page in a headless browser; a test that only reads the
  source doesn't count.
