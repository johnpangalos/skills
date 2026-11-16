# Feature Flow: Marginalia Books

## Kind

website; plain HTML, CSS and JavaScript, no build step, no external network requests.

## Checks

- Full: `node tests/run.mjs` (headless Chrome via Playwright over every page: a11y, 360px overflow, filter, form, no external requests)
- Targeted: `node tests/run.mjs <page-name>`
- Run it: `python3 -m http.server 8000` at the repo root, open http://localhost:8000/

## Conventions

- New page: own `.html` at repo root, shared header/nav/footer markup copied, link added to every page's nav, `aria-current="page"` on its own link, test added in tests/.
- Shared styles in `css/styles.css`, scripts in `js/`; no CDNs, no web fonts (system font stacks).

## Standing criteria

- 360px wide without sideways scrolling on every page.
- Filter state lives in the URL (bookmarkable, back button works).
- No request leaves the origin.

## Reviewer checklist

- Keyboard navigation and visible focus; skip link; landmarks; one h1 per page.
- 360px width without sideways scrolling.
- Form labels, errors tied to fields, announced; the form says plainly it's a demo and never claims a message was sent.
- Nothing decorative that looks interactive; contrast meets WCAG AA.
- Contrast is checked on rendered elements incl. hover/focus states (a:hover once beat .brand); overflow also checked at 360px with a 200% root font.
- Filter state in the URL; result count announced.
- Content real enough to judge: no lorem ipsum.
- Tests load pages in headless Chrome; source-only tests don't count.
