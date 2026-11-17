"""zsh-completion probe for fd-count: contrib/completion/_fd must offer --count, and every flag it
marks as exclusive with --count (either side of the exclusion) must really be a usage error with
--count in the built fd.  python3 zsh_count.py <build dir> <fd binary> <scratch dir>  -> exit 1 on the bug."""
import re, subprocess, sys

src, fd, cwd = sys.argv[1:4]
text = open(f"{src}/contrib/completion/_fd").read()
if "--count" not in text:
    print("no --count entry"); sys.exit(1)

groups, cur = {}, None
specs = []  # (group, exclusions, [flag specs])
for line in text.splitlines():
    s = line.strip()
    m = re.match(r"\+ '?\(?([\w-]+)\)?'?", s)
    if m:
        cur = m.group(1); groups.setdefault(cur, []); continue
    m = re.match(r"^\$?\w*'\(([^)]*)\)'?\{?([^\[]+?)\}?'?\[", s) or re.match(r"^'\(([^)]*)\)([^\[']+)\[", s)
    if not m or cur is None:
        continue
    excl = m.group(1).split()
    flags = [f.strip("'") for f in m.group(2).split(",")]
    names = [re.match(r"(-{1,2}[\w-]+)", f).group(1) for f in flags if re.match(r"-{1,2}[\w-]", f)]
    takes = any(f.endswith(("=", "+", "=-")) for f in flags)
    groups[cur] += [(n, takes) for n in names]
    specs.append((cur, excl, [(n, takes) for n in names]))

count_group = next((g for g, _, fl in specs if any(n == "--count" for n, _ in fl)), None)
VALUES = {"--exec": "echo", "-x": "echo", "--exec-batch": "echo", "-X": "echo", "--format": "{}"}


def usage_error(flag, takes):
    args = [fd, "--count", flag] + ([VALUES.get(flag, "1")] if takes else []) + ["foo"]
    return subprocess.run(args, cwd=cwd, capture_output=True, timeout=30).returncode == 2


# zsh excludes a named group as a unit, so a group on --count's own list is wrong only when none
# of its members conflicts with --count; a flag named explicitly (on --count's list, or on another
# option's list next to count/--count) is wrong when the CLI accepts it with --count.
wrong = []
for g, excl, fl in specs:
    names = [n for n, _ in fl]
    if "--count" in names:
        for e in excl:
            if e in groups:
                if e != count_group and not any(usage_error(n, t) for n, t in groups[e]):
                    wrong.append(f"group {e}")
            elif e not in ("--count", "-c") and not usage_error(e, False):
                wrong.append(e)
    elif count_group in excl or "--count" in excl or "-c" in excl:
        wrong += [f"{n} (excludes count)" for n, t in fl if not usage_error(n, t)]
if wrong:
    print("completion excludes flags the CLI accepts with --count:", ", ".join(wrong)); sys.exit(1)
