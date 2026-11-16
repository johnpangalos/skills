# Feature Flow: Marginalia Books website

## Kind

Website: static, plain HTML, CSS and JavaScript, no build step, no external network requests.

## Checks

- Full: `node --test tests/*.test.mjs` (headless Chrome via Playwright; Node 22 cannot take a bare directory to `--test`), then `npx prettier --check .`, then `npx eslint js/`
- Targeted: `node --test tests/<file>.test.mjs`
- Run it: `npx http-server -p 8080 -s .` then open http://localhost:8080/ (tests start their own static server)

## Conventions

- New page: its own `<name>.html` at the repo root, the shared nav and footer copied in with `aria-current="page"` on its own link, an entry in the README page list, and tests in `tests/`.
- Shared styles in `css/styles.css`, shared script in `js/main.js`, page scripts in `js/<page>.js`. No libraries, fonts or images from other hosts.

## Standing criteria

- Usable at 360px wide with no sideways scrolling.
- Filter, sort or search state lives in the URL query string.
- No request leaves the origin (no CDN, web font, analytics or remote image).
- JavaScript is required; working with it off is not a requirement.

## Reviewer checklist

- Keyboard navigation and visible focus on every interactive element; a skip link.
- 360px width without sideways scrolling, on every page.
- Form labels and errors: every field labelled, errors tied to fields and announced.
- Nothing decorative that looks interactive.
- Filter state lives in the URL so a result can be bookmarked and shared; back/forward restores it. Query values are trimmed and matched case-insensitively, then rewritten to the canonical form.
- The contact form says plainly that it's a demo; it never claims a message was sent when nothing was.
- Content is real enough to judge the design: no lorem ipsum, no one-line placeholder sections, lists long enough to need their filter.
- Tests that prove these load the page in a headless browser; a test that only reads the source doesn't count.
