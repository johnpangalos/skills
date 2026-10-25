"""Duplicated-code measure for paykit/: lines covered by a 6-line window that appears
more than once, after masking string literals and provider names (so a copy-and-rename
still counts). Prints the count, or compares against a baseline count.

    python3 duplication.py <repo>               # print the count
    python3 duplication.py <repo> <baseline>    # exit 1 if the count grew
"""

import pathlib
import re
import sys

WINDOW = 6
NAMES = re.compile(r"[A-Za-z_]*(acme|globex|initech|itc|gbx)[A-Za-z_]*", re.I)
STRINGS = re.compile(r"(b|f|rb|fr)?(\"[^\"\n]*\"|'[^'\n]*')")


def normalized(path):
    out = []
    for n, line in enumerate(path.read_text().splitlines()):
        s = line.strip()
        if not s or s.startswith("#") or s.startswith('"""'):
            continue
        s = STRINGS.sub("S", s)
        s = NAMES.sub("P", s)
        out.append((n, s))
    return out


def count(repo):
    files = [p for p in sorted(pathlib.Path(repo, "paykit").rglob("*.py")) if "test" not in p.name]
    seen, windows = {}, []
    for f in files:
        lines = normalized(f)
        for i in range(len(lines) - WINDOW + 1):
            key = tuple(s for _, s in lines[i:i + WINDOW])
            windows.append((f, [n for n, _ in lines[i:i + WINDOW]], key))
            seen[key] = seen.get(key, 0) + 1
    covered = set()
    for f, nums, key in windows:
        if seen[key] > 1:
            covered.update((str(f), n) for n in nums)
    return len(covered)


if __name__ == "__main__":
    value = count(sys.argv[1])
    if len(sys.argv) > 2:
        base = int(sys.argv[2])
        print(f"duplicated lines in paykit/: {value} (before the change: {base})")
        sys.exit(1 if value > base else 0)
    print(value)
