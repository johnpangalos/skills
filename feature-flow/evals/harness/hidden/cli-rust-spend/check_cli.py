"""Black-box checks for the spend CLI: check_cli.py <part>  (build|cargotest|flow|usage)"""

import os
import re
import subprocess
import sys
import tempfile

part = sys.argv[1]


def sh(cmd):
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=900)
    if proc.returncode:
        sys.exit(f"{cmd}: " + (proc.stdout + proc.stderr).strip()[-600:])


if part == "build":
    sh("cargo build --release -q")
    print("builds")
    sys.exit()
if part == "cargotest":
    sh("cargo test -q")
    print("cargo test passes")
    sys.exit()

sh("cargo build --release -q")
data = os.path.join(tempfile.mkdtemp(), "spend.data")
env = dict(os.environ, SPEND_FILE=data, NO_COLOR="1")


def spend(*args):
    p = subprocess.run(["./target/release/spend", *args], env=env, capture_output=True, text=True, timeout=30)
    return p.returncode, p.stdout, p.stderr


problems = []


def expect(cond, msg):
    if not cond:
        problems.append(msg)


if part == "flow":
    for args in (("12.50", "food", "lunch", "at", "noon"), ("30", "rent"), ("0.05", "food", "coffee")):
        code, out, err = spend("add", *args)
        expect(code == 0, f"add {args} -> {code} {err.strip()}")
    code, out, _ = spend("total")
    expect(code == 0 and "42.55" in out, f"total -> {out.strip()!r}")
    code, out, _ = spend("total", "--category", "food")
    expect("12.55" in out, f"total food -> {out.strip()!r}")
    code, out, _ = spend("list")
    lines = [l for l in out.splitlines() if "lunch" in l]
    expect(len(lines) == 1 and "lunch at noon" in lines[0], f"note not listed intact: {out!r}")
    expect(bool(re.search(r"\d{4}-\d{2}-\d{2}", out)), "no YYYY-MM-DD date in list")
    code, out, _ = spend("list", "--category", "food")
    expect("lunch" in out and "coffee" in out and "rent" not in out, f"list food -> {out!r}")
    code, out, _ = spend("list")
    rent = next((l for l in out.splitlines() if "rent" in l), "")
    rid = re.sub(r"[^\w-]", "", rent.split()[0]) if rent.split() else ""
    code, _, err = spend("rm", rid)
    expect(code == 0, f"rm {rid!r} -> {code} {err.strip()}")
    expect("12.55" in spend("total")[1], "total wrong after rm")
    code, _, err = spend("rm", "999999")
    expect(code == 1 and err.strip(), f"rm unknown -> {code}, stderr {err.strip()!r}")

elif part == "usage":
    for args in (("add", "abc", "food"), ("add", "1.234", "food"), ("add", "0", "food"), ("add",), ("frobnicate",)):
        code, _, err = spend(*args)
        expect(code == 2 and err.strip(), f"{' '.join(args)} -> exit {code}, stderr {err.strip()[:60]!r}")
    code, out, _ = spend("total")
    expect(code == 0 and "0.00" in out, f"usage errors changed data: total {out.strip()!r}")

if problems:
    sys.exit("; ".join(problems))
print(f"{part}: ok")
