"""Static checks for the bookshop site: check_site.py <part>  (pages|links|offline|a11y)"""

import pathlib
import re
import sys
from html.parser import HTMLParser


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []  # (tag, attrs); form fields inside a <label> get "_wrapped"
        self.title = ""
        self._in_title = False
        self._labels = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self._labels:
            attrs["_wrapped"] = True
        self.tags.append((tag, attrs))
        self._in_title = tag == "title"
        self._labels += tag == "label"

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "label" and self._labels:
            self._labels -= 1

    def handle_data(self, data):
        if self._in_title:
            self.title += data.strip()


root = pathlib.Path(".")
html_files = [p for p in root.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts]
pages = {}
for p in html_files:
    page = Page()
    page.feed(p.read_text(errors="replace"))
    pages[p] = page
problems = []
part = sys.argv[1]

if part == "pages":
    if not (root / "index.html").exists():
        problems.append("no index.html at the root")
    if len(pages) < 4:
        problems.append(f"only {len(pages)} pages")
    titles = [pg.title for pg in pages.values()]
    if any(not t for t in titles) or len(set(titles)) != len(titles):
        problems.append(f"titles missing or repeated: {titles}")

elif part == "links":
    for p, pg in pages.items():
        for tag, attrs in pg.tags:
            ref = attrs.get("href") if tag in ("a", "link") else attrs.get("src") if tag in ("img", "script", "source") else None
            if not ref or re.match(r"^(https?:|mailto:|tel:|#|data:|javascript:)", ref):
                continue
            target = (p.parent / ref.split("#")[0].split("?")[0]).resolve()
            if ref.split("#")[0] and not target.exists():
                problems.append(f"{p}: broken {ref}")

elif part == "offline":
    for p, pg in pages.items():
        for tag, attrs in pg.tags:
            ref = attrs.get("src") if tag in ("script", "img", "iframe", "source") else attrs.get("href") if tag == "link" else None
            if ref and re.match(r"^(https?:)?//", ref):
                problems.append(f"{p}: loads {ref}")
    for css in root.rglob("*.css"):
        if re.search(r"(@import|url\()\s*['\"]?(https?:)?//", css.read_text(errors="replace")):
            problems.append(f"{css}: remote import or url()")

elif part == "a11y":
    for p, pg in pages.items():
        tags = pg.tags
        html = next((a for t, a in tags if t == "html"), {})
        if not html.get("lang"):
            problems.append(f"{p}: no lang")
        if not any(t == "meta" and a.get("name") == "viewport" for t, a in tags):
            problems.append(f"{p}: no viewport meta")
        problems += [f"{p}: img without alt" for t, a in tags if t == "img" and "alt" not in a]
        labelled = {a.get("for") for t, a in tags if t == "label"}
        for t, a in tags:
            if t in ("input", "select", "textarea") and a.get("type") not in ("hidden", "submit", "button"):
                if a.get("id") not in labelled and not a.get("_wrapped") and not a.get("aria-label") and not a.get("aria-labelledby"):
                    problems.append(f"{p}: unlabelled {t} {a.get('name') or a.get('id')}")

if problems:
    sys.exit("; ".join(problems[:8]) + (f" (+{len(problems) - 8} more)" if len(problems) > 8 else ""))
print(f"{part}: ok across {len(pages)} pages")
