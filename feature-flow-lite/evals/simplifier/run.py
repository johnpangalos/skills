"""Run the simplifier agent alone on planted diffs and grade what it does.

    python3 run.py                                  # every case, old + new prompt, 3 reps
    python3 run.py -c two-pages -a new -n 1         # one case, one arm
    python3 run.py --regrade results/<ts>           # re-grade old runs after a grader change

Each case has a base/ tree (committed) and a feature/ overlay (the implementor's
finished, uncommitted change). The simplifier gets the handoff the orchestrator
would send, with the diff pasted in since it has no Bash. Arms differ only in the
agent prompt: `new` is agents/simplifier.md in the working tree, `old` is the same
file at --old-ref, and `variant` is any agent file passed with --variant. Results land in results/<ts>/<case>/<arm>/rep-<n>/.
"""

import argparse
import concurrent.futures
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

import grade

HERE = pathlib.Path(__file__).resolve().parent
CASES = HERE / "cases"
AGENT = HERE.parent.parent / "agents" / "simplifier.md"
SCRUB = [
    "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_EFFORT",
    "CLAUDE_CODE_EFFORT_LEVEL", "CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL_FORCE",
    "CLAUDECODE",
]
GIT = ["git", "-c", "user.name=eval", "-c", "user.email=eval@example.invalid"]

HANDOFF = """GOAL: Behavior-preserving cleanup of the finished diff below before it goes to review.
FILES: {files}
CONSTRAINTS: Only the lines this diff touched. No new dependencies. Tests must keep passing.
CHECKS: python3 -m unittest discover -s tests -t .{checks_note}{diff}"""


def agent_def(text):
    """Split an agent .md into the --agents JSON entry its frontmatter describes."""
    _, front, body = text.split("---", 2)
    meta = dict(line.split(": ", 1) for line in front.strip().splitlines())
    return {
        "description": meta["description"], "prompt": body.strip(), "model": meta["model"],
        "tools": [t.strip() for t in meta["tools"].split(",")],
    }, meta.get("effort", "medium")


def arm_prompt(arm, old_ref, variant=None):
    if arm == "variant":
        return pathlib.Path(variant).read_text()
    if arm == "new":
        return AGENT.read_text()
    rel = AGENT.relative_to(subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], cwd=HERE, capture_output=True, text=True, check=True,
    ).stdout.strip())
    return subprocess.run(["git", "show", f"{old_ref}:{rel}"], cwd=HERE, capture_output=True,
                          text=True, check=True).stdout


def prepare(case, ws):
    shutil.copytree(CASES / case / "base", ws)
    with open(ws / ".gitignore", "w") as f:
        f.write("__pycache__/\n.claude/\n")
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=ws, check=True)
    subprocess.run(GIT + ["add", "-A"], cwd=ws, check=True)
    subprocess.run(GIT + ["commit", "-qm", "base"], cwd=ws, check=True)
    shutil.copytree(CASES / case / "feature", ws, dirs_exist_ok=True)
    subprocess.run(["git", "add", "-A", "-N"], cwd=ws, check=True)
    diff = subprocess.run(["git", "diff", "HEAD"], cwd=ws, capture_output=True, text=True, check=True).stdout
    files = subprocess.run(["git", "diff", "HEAD", "--name-only"], cwd=ws, capture_output=True,
                           text=True, check=True).stdout.split()
    return diff, files


def run_one(out, case, arm, rep, prompt_text):
    run_dir = out / case / arm / f"rep-{rep}"
    run_dir.mkdir(parents=True)
    ws = pathlib.Path(tempfile.mkdtemp(prefix=f"simp-{case}-")) / "repo"
    diff, files = prepare(case, ws)
    snapshot = ws.parent / "feature"
    shutil.copytree(ws, snapshot, ignore=shutil.ignore_patterns(".git"))
    definition, effort = agent_def(prompt_text)
    # an agent without Bash can't see the diff or run the checks, so the orchestrator pastes it
    shell = "Bash" in definition["tools"]
    handoff = HANDOFF.format(
        files=", ".join(files),
        checks_note="" if shell else " (you can't run it; I re-run it after you)",
        diff="" if shell else f"\nDIFF:\n{diff}",
    )
    (run_dir / "handoff.txt").write_text(handoff)
    cmd = [
        "claude", "-p", handoff, "--agents", json.dumps({"simplifier": definition}),
        "--agent", "simplifier", "--model", definition["model"], "--effort", effort,
        "--output-format", "stream-json", "--verbose",
        "--permission-mode", "acceptEdits", "--allowedTools", ",".join(definition["tools"]),
        "--permission-prompts", "none", "--max-budget-usd", "1", "--no-session-persistence",
    ]
    env = {k: v for k, v in os.environ.items() if k not in SCRUB}
    proc = subprocess.run(cmd, cwd=ws, env=env, capture_output=True, text=True, timeout=900)
    (run_dir / "trace.jsonl").write_text(proc.stdout)
    (run_dir / "stderr.txt").write_text(proc.stderr)
    shutil.copytree(ws, run_dir / "final", ignore=shutil.ignore_patterns(".git", "__pycache__"))
    shutil.copytree(snapshot, run_dir / "feature", ignore=shutil.ignore_patterns("__pycache__"))
    result = grade.grade(case, run_dir, files)
    (run_dir / "grade.json").write_text(json.dumps(result, indent=2))
    shutil.rmtree(ws.parent, ignore_errors=True)
    return case, arm, rep, result


def summarize(out):
    rows = []
    for g in sorted(out.glob("*/*/rep-*/grade.json")):
        case, arm, rep = g.parts[-4:-1]
        rows.append((case, arm, rep, json.loads(g.read_text())))
    lines = ["| case | arm | rep | pass | tests | behavior | scope | notes |", "|---|---|---|---|---|---|---|---|"]
    for case, arm, rep, r in rows:
        lines.append(f"| {case} | {arm} | {rep} | {'yes' if r['pass'] else 'no'} | {r['tests']} | "
                     f"{r['behavior']} | {r['scope']} | {'; '.join(r['notes'])} |")
    totals = {}
    for case, arm, _, r in rows:
        t = totals.setdefault((case, arm), [0, 0])
        t[0] += r["pass"]; t[1] += 1
    lines += ["", "| case | " + " | ".join(sorted({a for _, a in totals})) + " |"]
    arms = sorted({a for _, a in totals})
    lines.append("|---|" + "---|" * len(arms))
    for case in sorted({c for c, _ in totals}):
        lines.append(f"| {case} | " + " | ".join(
            "{}/{}".format(*totals[(case, a)]) if (case, a) in totals else "-" for a in arms) + " |")
    (out / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("-c", "--cases", default=",".join(sorted(d.name for d in CASES.iterdir())))
    p.add_argument("-a", "--arms", default="old,new")
    p.add_argument("-n", "--reps", type=int, default=3)
    p.add_argument("-j", "--jobs", type=int, default=6)
    p.add_argument("--old-ref", default="main")
    p.add_argument("--variant", help="an agent .md to run as the `variant` arm")
    p.add_argument("--regrade")
    args = p.parse_args()
    if args.regrade:
        out = pathlib.Path(args.regrade)
        for g in out.glob("*/*/rep-*"):
            files = [str(f.relative_to(CASES / g.parts[-3] / "feature")) for f in (CASES / g.parts[-3] / "feature").rglob("*.py")]
            (g / "grade.json").write_text(json.dumps(grade.grade(g.parts[-3], g, files), indent=2))
        return summarize(out)
    out = HERE / "results" / subprocess.run(["date", "+%Y%m%d-%H%M%S"], capture_output=True, text=True).stdout.strip()
    prompts = {arm: arm_prompt(arm, args.old_ref, args.variant) for arm in args.arms.split(",")}
    jobs = [(c, a, r) for c in args.cases.split(",") for a in prompts for r in range(1, args.reps + 1)]
    with concurrent.futures.ThreadPoolExecutor(args.jobs) as pool:
        for case, arm, rep, r in pool.map(lambda j: run_one(out, j[0], j[1], j[2], prompts[j[1]]), jobs):
            print(f"{case} {arm} rep-{rep}: {'PASS' if r['pass'] else 'FAIL'} {'; '.join(r['notes'])}", flush=True)
    summarize(out)


if __name__ == "__main__":
    main()
