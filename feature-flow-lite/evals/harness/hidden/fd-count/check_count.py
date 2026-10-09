"""Black-box tests for `fd --count`: python3 check_count.py <path to fd binary>"""

import os
import re
import subprocess
import sys
import tempfile

FD = os.path.abspath(sys.argv[1])
failures = []


def fd(*args, cwd):
    return subprocess.run([FD, *args], cwd=cwd, capture_output=True, text=True, timeout=60)


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def tree(root):
    files = [
        "src/a.rs", "src/b.rs", "src/lib/c.rs", "src/lib/d.txt", "docs/readme.md",
        "docs/guide.md", ".hidden/x.rs", ".env", "ignored/i.rs", "build.log", "Makefile",
    ]
    for f in files:
        os.makedirs(os.path.join(root, os.path.dirname(f)), exist_ok=True)
        open(os.path.join(root, f), "w").close()
    os.makedirs(os.path.join(root, "empty_dir"))
    os.symlink("src/a.rs", os.path.join(root, "link_a"))
    with open(os.path.join(root, ".gitignore"), "w") as f:
        f.write("ignored/\n*.log\n")
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)


with tempfile.TemporaryDirectory() as root:
    tree(root)
    arg_sets = [
        [], ["-e", "rs"], ["-t", "f"], ["-t", "d"], ["-t", "l"], ["-t", "e"], ["-H"], ["-I"],
        ["-HI"], ["--max-depth", "1"], ["--min-depth", "2"], ["-E", "docs"], ["rs$"],
        ["-g", "*.md"], ["a", "--and", "rs"], ["-e", "rs", ".", "src", "docs"], ["-L"],
        ["-s"], ["--threads", "1", "-H"], ["-p", "lib"],
    ]
    for args in arg_sets:
        plain = fd(*args, cwd=root)
        counted = fd("--count", *args, cwd=root)
        lines = [l for l in plain.stdout.splitlines() if l]
        check(
            f"--count {' '.join(args)} equals the number of results",
            counted.returncode == 0 and counted.stdout == f"{len(lines)}\n",
            f"got {counted.stdout!r} (exit {counted.returncode}, stderr {counted.stderr.strip()!r}), want {len(lines)}",
        )

    r = fd("--count", "no-such-name", cwd=root)
    check("no matches prints 0 and exits 0", r.returncode == 0 and r.stdout == "0\n", f"{r.returncode} {r.stdout!r}")

    total = len(fd(cwd=root).stdout.splitlines())
    for args, want in [(["--max-results", "2"], "2"), (["-1"], "1"), (["--max-results=0"], str(total)),
                       (["--max-results", "1000"], str(total))]:
        r = fd("--count", *args, cwd=root)
        check(f"--count {' '.join(args)} gives {want}", r.returncode == 0 and r.stdout.strip() == want, f"got {r.stdout!r}")

    r = fd("--count", "--color=always", cwd=root)
    check("--color=always still prints a bare number", re.fullmatch(r"\d+\n", r.stdout) is not None, repr(r.stdout))

    for args in [["-x", "echo"], ["-X", "echo"], ["-l"], ["--format", "{}"], ["-0"], ["-q"]]:
        r = fd("--count", *args, cwd=root)
        check(f"--count conflicts with {args[0]}", r.returncode == 2 and r.stdout == "" and "error" in r.stderr.lower(),
              f"exit {r.returncode} stdout {r.stdout[:60]!r}")
        r = fd(*args, "--count", cwd=root) if args[0] not in ("-x", "-X") else r
        check(f"{args[0]} before --count also conflicts", r.returncode == 2, f"exit {r.returncode}")

    # the usage error names only the flags the user passed
    for args, absent in [(["-l"], "--exec"), (["-x", "echo"], "--list-details"), (["-0"], "--exec")]:
        r = fd("--count", *args, cwd=root)
        check(f"--count {args[0]} error doesn't mention {absent}", absent not in r.stderr, r.stderr.strip()[:160])

with tempfile.TemporaryDirectory() as root:
    # enough results that fd switches from buffering to streaming mode
    for d in range(30):
        os.makedirs(os.path.join(root, f"d{d}"))
        for i in range(100):
            open(os.path.join(root, f"d{d}", f"f{i}.txt"), "w").close()
    r = fd("--count", "-t", "f", cwd=root)
    check("3000 files counted", r.stdout == "3000\n", repr(r.stdout[:80]))
    r = fd("--count", "--max-results", "2500", cwd=root)
    check("--max-results caps a large count", r.stdout == "2500\n", repr(r.stdout[:80]))

print(f"\n{len(failures)} failed")
sys.exit(1 if failures else 0)
