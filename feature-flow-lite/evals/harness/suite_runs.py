#!/usr/bin/env python3
"""Count full playtest-suite runs per build, split into the main thread and subagents.

    python3 suite_runs.py results/<batch> [results/<batch> ...]

A full run is a Bash command that runs `//playtests:test`, `vp test run` or `vitest run` with no
test file or name filter after it. Commands are read from each run's trace.jsonl.
"""
import json
import re
import shlex
import sys
from pathlib import Path

SUITE = re.compile(r"//playtests:test|\bvp test run\b|\bvitest run\b")


def is_full_suite(cmd):
    """True when some piece of the command runs the whole suite."""
    for part in re.split(r"&&|\|\||;|\|", cmd):
        m = SUITE.search(part)
        if not m:
            continue
        try:
            rest = shlex.split(part[m.end():])
        except ValueError:
            rest = part[m.end():].split()
        args = []
        for tok in rest:
            if tok in (">", "2>&1") or tok.startswith((">", "2>")):
                break
            args.append(tok)
        # a positional argument (a file or a name filter) or -t narrows the run
        if any(not a.startswith("-") for a in args if a != "--") or any(a in ("-t", "--testNamePattern") or a.startswith("-t") for a in args):
            continue
        return True
    return False


def count(trace):
    main = sub = 0
    for line in trace.open():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("type") != "assistant":
            continue
        for c in e.get("message", {}).get("content", []):
            if c.get("type") == "tool_use" and c.get("name") == "Bash" and is_full_suite(c.get("input", {}).get("command", "")):
                if e.get("parent_tool_use_id"):
                    sub += 1
                else:
                    main += 1
    return main, sub


def main():
    rows = {}
    for batch in sys.argv[1:]:
        for trace in sorted(Path(batch).glob("*/*/rep-*/trace.jsonl")):
            rep = trace.parent
            m, s = count(trace)
            print(f"{rep.parent.parent.name:22} {rep.parent.name:20} {rep.name:6} main {m}  sub {s}")
            rows.setdefault((rep.parent.parent.name, rep.parent.name), []).append((m, s))
    print()
    for (scen, arm), vals in sorted(rows.items()):
        n = len(vals)
        m = sum(v[0] for v in vals) / n
        s = sum(v[1] for v in vals) / n
        print(f"{scen:22} {arm:20} n={n}  main {m:.1f}  sub {s:.1f}  total {m + s:.1f}")


if __name__ == "__main__":
    main()
