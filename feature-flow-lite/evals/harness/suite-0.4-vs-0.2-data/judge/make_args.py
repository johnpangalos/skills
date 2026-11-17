"""Build judge.workflow.js args for one or more tasks from blind copies under a root dir.

    python3 make_args.py <root> <task> [<task> ...] > args.json

<root>/<task>/<letter>[ .diff | -shots ] as prepare_blind.py writes them. Each task gets 2 judges.
"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
SCEN = {s["id"]: s for s in json.load(open(HERE.parents[1] / "scenarios.json"))["scenarios"]}
SHOP = ("This is a change to a small Python package. In your copy run its tests (python3 -m pytest -q, or "
        "python3 -m unittest discover -s tests), read the change and the code around it, then write throwaway "
        "tests that probe the task's edge cases: every boundary the task names, invalid, empty, zero, negative, "
        "non-numeric and very large inputs, repeated calls, and, where the task involves state or money, "
        "concurrent use from threads and partial failure leaving nothing changed.")
KIND = {
    "ui-lib": ("component", None),
    "website-bookshop": ("website", None),
    "tailwind-anchor": ("library", None),
    "chi-etag": ("feature", "In your copy: go build ./... && go test ./... && go vet ./... and gofmt -l. Then write throwaway Go tests against middleware.ETag: GET/HEAD/POST, 200 and non-200, a handler that sets its own ETag, If-None-Match with weak tags, lists, * and garbage members, Flush/Hijack/ReadFrom on the wrapped writer, http.ServeContent behind it, HEAD from a handler that writes no body, and the README table row."),
    "chi-mount-routes": ("feature", "In your copy: go test ./... && go vet ./... and gofmt -l. Then write throwaway tests that register handlers with Get/Handle, Route() and Mount() on the same and nested patterns in different orders, and check chi.Walk and Router.Routes() list every method and pattern once, plus that routing itself still works."),
    "click-duration": ("feature", "In your copy: uv sync, then uv run pytest -q, uv run mypy --strict src/click (or the repo's configured mypy) and ruff. Then use the Duration type from throwaway scripts and tests: every unit and combination, whitespace, signs, zero, huge values, bad input and its error message, min/max bounds and how they show in --help, defaults shown in help, and the docs and changelog entry."),
    "click-param-spec": ("feature", "In your copy: uv sync, then uv run pytest -q and the repo's type and lint checks. Then exercise Parameter.spec and get_help_spec on options and arguments, error messages that quote specs, and the human_readable_name deprecation: subclasses overriding it directly and through an intermediate class, warnings raised once, and the docs and changelog."),
    "fd-count": ("feature", "In your copy: cargo build && cargo test, cargo clippy and cargo fmt --check. Then run the built fd with --count against a temp tree: with and without matches, with filters, --max-results, --exec conflicts, broken pipes, and check the man page, the zsh completion and the changelog."),
    "rac-shadow-hide": ("feature", "This build's folder holds only the touched files; build the full tree instead: rm -rf <your copy> && cp -r /tmp/ffj/rac-base <your copy> && cd <your copy> && git apply --exclude='bin/*' <the .diff next to the build> (the blind diffs wrongly delete bin/, which holds the repo's eslint rules; never apply that part). Then run yarn jest packages/@react-aria/overlays and the repo's lint and type check on the touched files, and write throwaway jest tests for ariaHideOutside across shadow DOM: targets inside one or several shadow roots, a target nested in a shadow root inside another target, slotted light-DOM content, elements and shadow roots added after the call, live regions and top-layer elements, and undo restoring everything."),
}
def challenge(task, d):
    kind, probe = KIND.get(task, ("feature", SHOP))
    d = pathlib.Path(d)
    builds = []
    for p in sorted(x for x in d.iterdir() if x.is_dir() and not x.name.endswith("-shots")):
        b = {"letter": p.name, "dir": str(p)}
        if (d / f"{p.name}.diff").exists():
            b["diff"] = str(d / f"{p.name}.diff")
        if (d / f"{p.name}-shots").exists():
            b["shots"] = str(d / f"{p.name}-shots")
        builds.append(b)
    ch = {"id": task, "kind": kind, "prompt": SCEN[task]["prompt"], "builds": builds, "judges": 2}
    if probe:
        ch["probe"] = probe
    return ch


if __name__ == "__main__":
    root = pathlib.Path(sys.argv[1]).resolve()
    json.dump([challenge(t, root / t) for t in sys.argv[2:]], sys.stdout, indent=1)
