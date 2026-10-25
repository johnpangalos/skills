"""Grade one simplifier run: final/ against the feature/ snapshot it started from.

Every case checks that tests pass, that behavior.py prints the same thing before and
after, and that only the diff's files changed. Then each case checks its own point:

  two-pages       two look-alike pages stay two pages (no shared renderer, no mode flag)
  twin-pages      two whole pages that differ only in wording stay two pages
  two-handlers    two look-alike handlers stay two handlers (extracting the
                  required-fields check, a real building block, is noted, not required)
  flag-helper     a helper that picks each caller's path with flags gets inlined or split
  date-formatter  a real building block copied three times gets extracted once
  dead-code       dead code and a pass-through wrapper still get removed
"""

import ast
import os
import pathlib
import re
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
FLAG_NAME = re.compile(r"^(is|has|for|as|show|include|use)_|^(mode|kind|variant|type|doc_type|page_type|entity|entity_type|template|which)$")


def run(cmd, cwd):
    env = dict(os.environ, PYTHONPATH=str(cwd), PYTHONDONTWRITEBYTECODE="1")
    return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=120)


def functions(tree_dir):
    """{name: FunctionDef} for every top-level function under shop/."""
    out = {}
    for f in sorted((tree_dir / "shop").glob("*.py")):
        for node in ast.parse(f.read_text()).body:
            if isinstance(node, ast.FunctionDef):
                out[node.name] = node
    return out


def flag_params(fn):
    """Parameters that look like they pick a caller's path."""
    args = fn.args.args + fn.args.kwonlyargs
    defaults = dict(zip([a.arg for a in fn.args.args][::-1], fn.args.defaults[::-1]))
    defaults.update({a.arg: d for a, d in zip(fn.args.kwonlyargs, fn.args.kw_defaults) if d is not None})
    flagged = set()
    for a in args:
        d = defaults.get(a.arg)
        if FLAG_NAME.search(a.arg) or (isinstance(d, ast.Constant) and isinstance(d.value, bool)):
            flagged.add(a.arg)
    for node in ast.walk(fn):  # `if kind == "invoice"`
        if isinstance(node, ast.Compare) and isinstance(node.left, ast.Name) and any(
                isinstance(c, ast.Constant) and isinstance(c.value, str) for c in node.comparators):
            if node.left.id in {a.arg for a in args}:
                flagged.add(node.left.id)
    return sorted(flagged)


def calls(fn):
    return {n.func.id for n in ast.walk(fn) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}


def source(tree_dir):
    return "\n".join(f.read_text() for f in sorted((tree_dir / "shop").glob("*.py")))


def has_literal(fn, text):
    return any(isinstance(n, ast.Constant) and isinstance(n.value, str) and text in n.value for n in ast.walk(fn))


def shared_by(fns, a, b):
    """Helpers that both a and b call."""
    if a not in fns or b not in fns:
        return set()
    return (calls(fns[a]) & calls(fns[b])) & set(fns)


def grade(case, run_dir, diff_files):
    final, feature = run_dir / "final", run_dir / "feature"
    notes = []
    tests = run(["python3", "-m", "unittest", "discover", "-s", "tests", "-t", "."], final)
    tests_ok = tests.returncode == 0
    if not tests_ok:
        notes.append("tests fail: " + (tests.stderr.strip().splitlines() or ["?"])[-1])
    behavior_script = str(HERE / "cases" / case / "behavior.py")
    before, after = run(["python3", behavior_script], feature), run(["python3", behavior_script], final)
    behavior_ok = after.returncode == 0 and before.stdout == after.stdout
    if not behavior_ok:
        notes.append("behavior changed")
    changed = []
    for f in sorted(p for p in final.rglob("*") if p.is_file()):
        rel = f.relative_to(final).as_posix()
        orig = feature / rel
        if not orig.exists() or orig.read_bytes() != f.read_bytes():
            changed.append(rel)
    for f in feature.rglob("*"):
        if f.is_file() and not (final / f.relative_to(feature)).exists():
            changed.append(f.relative_to(feature).as_posix() + " (deleted)")
    out_of_scope = [c for c in changed if c.split(" ")[0] not in diff_files]
    scope_ok = not out_of_scope
    if out_of_scope:
        notes.append("out of scope: " + ", ".join(out_of_scope))
    if not changed:
        notes.append("no edits")

    fns = functions(final)
    flagged = {name: flag_params(fn) for name, fn in fns.items() if flag_params(fn)}
    if flagged:
        notes.append("flag params: " + ", ".join(f"{n}({', '.join(p)})" for n, p in flagged.items()))
    src = source(final)
    point = False

    if case in ("two-pages", "twin-pages"):
        pages = {"render_invoice_page", "render_receipt_page"} if case == "two-pages" else {"order_confirmed_page", "order_shipped_page"}
        merged = [n for n, fn in fns.items() if n not in pages and has_literal(fn, "<html")]
        if not pages <= set(fns):
            notes.append("a page function is gone")
        if merged:
            notes.append("pages merged into " + ", ".join(merged))
        helpers = shared_by(fns, *pages)
        if helpers:
            notes.append("shared blocks: " + ", ".join(sorted(helpers)))
        point = pages <= set(fns) and not merged and not flagged
    elif case == "two-handlers":
        handlers = {"create_user", "create_product"}
        merged = [n for n in shared_by(fns, *handlers)
                  if any(isinstance(t, ast.Subscript) for a in ast.walk(fns[n]) if isinstance(a, ast.Assign) for t in a.targets)
                  and has_literal(fns[n], "missing field")]
        if not handlers <= set(fns):
            notes.append("a handler is gone")
        if merged:
            notes.append("handlers merged into " + ", ".join(merged))
        helpers = shared_by(fns, *handlers)
        if helpers:
            notes.append("shared blocks: " + ", ".join(sorted(helpers)))
        if src.count("missing field") > 1:
            notes.append("required-fields check left duplicated")
        point = handlers <= set(fns) and not merged and not flagged
    elif case == "flag-helper":
        if "send_notification" in fns and not flagged:
            notes.append("send_notification kept without flags")
        point = not flagged
    elif case == "date-formatter":
        copies = src.count("11 <=")
        notes.append(f"suffix logic copies: {copies}")
        point = copies == 1 and not flagged
    elif case == "dead-code":
        gone = {
            "import json": "import json" not in src, "import math": "import math" not in src,
            "_get_subtotal": "_get_subtotal" not in src, "debug": "debug" not in src,
            "doubled": "doubled" not in src, "unreachable print": "applied discount" not in src,
        }
        left = [k for k, v in gone.items() if not v]
        notes.append(f"dead code removed {sum(gone.values())}/6" + (f" (left: {', '.join(left)})" if left else ""))
        point = not left

    return {
        "pass": bool(tests_ok and behavior_ok and scope_ok and point),
        "tests": "ok" if tests_ok else "FAIL", "behavior": "same" if behavior_ok else "CHANGED",
        "scope": "ok" if scope_ok else "OUT", "point": point, "changed": changed, "notes": notes,
    }
