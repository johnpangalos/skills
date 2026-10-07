"""Black-box contract checks for the bookmarks API: check_api.py <part>
parts: build | gotest | crud | errors | filter | concurrency"""

import concurrent.futures
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

part = sys.argv[1]


def run(cmd):
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=600)
    if proc.returncode:
        sys.exit(f"{cmd}: " + (proc.stdout + proc.stderr).strip()[-600:])


if part == "build":
    run("go build -o bin/server ./cmd/server")
    print("builds")
    sys.exit()
if part == "gotest":
    run("go vet ./... && go test ./...")
    print("vet and tests pass")
    sys.exit()

run("go build -o bin/server ./cmd/server")
with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
server = subprocess.Popen(["./bin/server"], env=dict(os.environ, PORT=str(port)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
base = f"http://127.0.0.1:{port}"


def call(method, path, body=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            text = r.read().decode()
            return r.status, dict(r.headers), (json.loads(text) if text.strip() else None)
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            payload = json.loads(text) if text.strip() else None
        except ValueError:
            payload = text
        return e.code, dict(e.headers), payload


problems = []


def expect(cond, msg):
    if not cond:
        problems.append(msg)


try:
    for _ in range(100):
        try:
            if call("GET", "/health")[0] == 200:
                break
        except OSError:
            time.sleep(0.1)
    else:
        sys.exit("server never answered /health")

    if part == "crud":
        st, hd, bm = call("POST", "/bookmarks", {"url": "https://go.dev", "title": "Go", "tags": ["lang"]})
        expect(st == 201, f"create -> {st}")
        bid = bm.get("id") if isinstance(bm, dict) else None
        expect(bid is not None and {"url", "title", "tags", "created_at"} <= set(bm), f"create body {bm}")
        loc = {k.lower(): v for k, v in hd.items()}.get("location", "")
        expect(loc.endswith(f"/bookmarks/{bid}"), f"Location {loc!r}")
        st, _, got = call("GET", f"/bookmarks/{bid}")
        expect(st == 200 and got.get("title") == "Go", f"get -> {st} {got}")
        call("POST", "/bookmarks", {"url": "https://example.com/b", "title": "Second"})
        st, _, items = call("GET", "/bookmarks")
        expect(st == 200 and isinstance(items, list) and len(items) == 2, f"list -> {st} {items}")
        if isinstance(items, list) and len(items) == 2:
            expect(items[0].get("title") == "Second", "list is not newest first")
        st, _, upd = call("PATCH", f"/bookmarks/{bid}", {"title": "Go home"})
        expect(st == 200 and upd.get("title") == "Go home" and upd.get("url") == "https://go.dev", f"patch -> {st} {upd}")
        st, _, _ = call("DELETE", f"/bookmarks/{bid}")
        expect(st == 204, f"delete -> {st}")
        expect(call("GET", f"/bookmarks/{bid}")[0] == 404, "deleted bookmark still found")

    elif part == "errors":
        st, _, body = call("POST", "/bookmarks", raw=b"{not json")
        expect(st == 400 and isinstance(body, dict) and "error" in body, f"malformed -> {st} {body}")
        for bad in ({"url": "notaurl", "title": "x"}, {"url": "ftp://x.org", "title": "x"}, {"url": "https://x.org", "title": ""}, {"title": "no url"}):
            st, _, body = call("POST", "/bookmarks", bad)
            expect(st == 422 and isinstance(body, dict) and "error" in body, f"{bad} -> {st} {body}")
        expect(call("GET", "/bookmarks/does-not-exist-999")[0] == 404, "unknown id is not 404")
        expect(call("DELETE", "/bookmarks/does-not-exist-999")[0] == 404, "delete unknown is not 404")
        st, _, bm = call("POST", "/bookmarks", {"url": "https://ok.org", "title": "ok"})
        st, _, body = call("PATCH", f"/bookmarks/{bm['id']}", {"url": "nope"})
        expect(st == 422, f"patch invalid -> {st}")

    elif part == "filter":
        call("POST", "/bookmarks", {"url": "https://a.org", "title": "a", "tags": ["x", "y"]})
        call("POST", "/bookmarks", {"url": "https://b.org", "title": "b", "tags": ["y"]})
        call("POST", "/bookmarks", {"url": "https://c.org", "title": "c"})
        st, _, items = call("GET", "/bookmarks?tag=y")
        expect(st == 200 and sorted(i["title"] for i in items) == ["a", "b"], f"tag=y -> {items}")
        st, _, items = call("GET", "/bookmarks?tag=x")
        expect([i["title"] for i in items] == ["a"], f"tag=x -> {items}")

    elif part == "concurrency":
        with concurrent.futures.ThreadPoolExecutor(32) as pool:
            codes = list(pool.map(lambda n: call("POST", "/bookmarks", {"url": f"https://n{n}.org", "title": f"n{n}"})[0], range(200)))
        expect(codes.count(201) == 200, f"{200 - codes.count(201)} concurrent creates failed")
        st, _, items = call("GET", "/bookmarks")
        ids = [i["id"] for i in items]
        expect(len(items) == 200 and len(set(ids)) == 200, f"{len(items)} listed, {len(set(ids))} unique ids")
finally:
    server.terminate()

if problems:
    sys.exit("; ".join(problems))
print(f"{part}: ok")
