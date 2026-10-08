"""Run feature-flow scenarios headlessly and grade them.

    python3 run.py                                   # every scenario, skill + baseline, 1 rep
    python3 run.py -s discount-codes -a skill,baseline,sonnet-solo -n 3 -j 3
    python3 run.py --dry-run                         # print the claude commands only
    python3 run.py --regrade results/<ts>            # re-apply changed checks to old runs

Each run copies fixtures/shop into a fresh temp git repo (plus the scenario's
overlay and setup), loads the skill the way its arm says (as a plugin with its
named agents, or as a bare project skill, optionally from a git ref), runs
`claude -p` with a stream-json trace, then grades it with grade.py.
Results land in results/<timestamp>/<scenario>/<arm>/rep-<n>/ with a summary.md.
"""

import argparse
import concurrent.futures
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time

import grade

HERE = pathlib.Path(__file__).resolve().parent
SKILL_DIR = HERE.parent.parent
FIXTURES = HERE / "fixtures"
TOOLS = "Bash,Read,Edit,Write,Glob,Grep,Agent,Skill"

# session-scoped variables that would leak the calling session (or its model
# and effort overrides) into the runs under test
SCRUB = [
    "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_EFFORT",
    "CLAUDE_CODE_EFFORT_LEVEL", "CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL_FORCE",
    "CLAUDECODE",
]


def prepare(workspace, scenario, arm):
    skip = shutil.ignore_patterns("__pycache__", ".ruff_cache")
    if scenario.get("fixture") == "empty":
        workspace.mkdir(parents=True)  # greenfield: an empty repo
    else:
        shutil.copytree(FIXTURES / "shop", workspace, ignore=skip)
    if scenario.get("overlay"):
        shutil.copytree(FIXTURES / "overlays" / scenario["overlay"], workspace, ignore=skip, dirs_exist_ok=True)
    env = dict(os.environ, FIXTURES=str(FIXTURES))
    if scenario.get("setup"):
        subprocess.run(scenario["setup"], shell=True, cwd=workspace, env=env, check=True)
    git = ["git", "-c", "user.name=eval", "-c", "user.email=eval@example.invalid"]
    if not (workspace / ".git").exists():  # a setup that checks out a real repo brings its own history
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=workspace, check=True)
        subprocess.run(git + ["add", "-A"], cwd=workspace, check=True)
        subprocess.run(git + ["commit", "-qm", "fixture", "--allow-empty"], cwd=workspace, check=True)
    with open(workspace / ".git" / "info" / "exclude", "a") as f:
        f.write("__pycache__/\n.claude/\ntarget/\nbin/\nnode_modules/\n")
    if arm["skill"] == "project":
        target = workspace / ".claude" / "skills" / "feature-flow"
        target.mkdir(parents=True)
        shutil.copy(arm["source"] / "SKILL.md", target / "SKILL.md")


def skill_source(ref, folder=None):
    """A skill folder (default feature-flow) at a git ref, or in the working tree when ref is None."""
    if folder:
        return (SKILL_DIR.parent / folder).resolve()
    if not ref:
        return SKILL_DIR
    def git(*args):
        return subprocess.run(["git", *args], cwd=SKILL_DIR, capture_output=True, check=True).stdout

    prefix = git("rev-parse", "--show-prefix").decode().strip()
    root = git("rev-parse", "--show-toplevel").decode().strip()
    dest = pathlib.Path(tempfile.mkdtemp(prefix="ff-skill-"))
    archive = subprocess.run(["git", "archive", ref, "--", prefix], cwd=root, capture_output=True, check=True).stdout
    subprocess.run(["tar", "-x", "-C", str(dest)], input=archive, check=True)
    return dest / prefix


def command(scenario, arm, prompt):
    # a plugin-loaded skill is namespaced under its plugin name
    name = arm["source"].name if arm["skill"] else ""
    prefix = {"plugin": f"/{name}:{name} ", "project": f"/{name} "}.get(arm["skill"], "")
    plugin = ["--plugin-dir", str(arm["source"])] if arm["skill"] == "plugin" else []
    return [
        "claude", "-p", prefix + prompt, *plugin,
        "--model", arm["model"], "--effort", arm["effort"],
        "--output-format", "stream-json", "--verbose", "--forward-subagent-text",
        "--permission-mode", "acceptEdits", "--allowedTools", TOOLS, "--permission-prompts", "none",
        "--max-budget-usd", str(scenario.get("budget_usd", 5)),
        "--no-session-persistence",
    ]


def run_one(out, scenario, arm_name, arm, rep, prompt, dry_run):
    cmd = command(scenario, arm, prompt)
    if dry_run:
        print(" ".join(repr(c) if " " in c else c for c in cmd))
        return None
    run_dir = out / scenario["id"] / arm_name / f"rep-{rep}"
    run_dir.mkdir(parents=True, exist_ok=True)
    scratch = pathlib.Path(tempfile.mkdtemp(prefix="ff-eval-"))  # outside any repo, so no CLAUDE.md leaks in
    workspace = scratch / "workspace"
    prepare(workspace, scenario, arm)
    env = {k: v for k, v in os.environ.items() if k not in SCRUB}
    env["CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH"] = str(scenario.get("depth", 3))
    started = time.time()
    with open(run_dir / "trace.jsonl", "w") as trace, open(run_dir / "stderr.txt", "w") as err:
        try:
            subprocess.run(cmd, cwd=workspace, env=env, stdout=trace, stderr=err, timeout=scenario.get("timeout_s", 2400))
        except subprocess.TimeoutExpired:
            err.write("\nharness: timed out\n")
    diff = subprocess.run(
        "git add -A -N . ':!.claude' && git diff HEAD -- . ':!.claude'",
        shell=True, cwd=workspace, capture_output=True, text=True,
    ).stdout
    (run_dir / "diff.patch").write_text(diff)
    (run_dir / "meta.json").write_text(json.dumps({
        "scenario": scenario["id"], "arm": arm_name, "rep": rep, "command": cmd,
        "wall_s": round(time.time() - started, 1), "workspace": str(workspace),
    }, indent=2))
    result = grade.grade(run_dir, scenario, arm)
    summary = result["summary"]
    print(f"{scenario['id']:<22} {arm_name:<12} rep {rep}: {summary['passed']}/{summary['total']} checks, ${result['metrics']['cost_usd']}", flush=True)
    return scenario["id"], arm_name, result


def summarize(out, results):
    rows = {}
    for scenario_id, arm_name, result in results:
        rows.setdefault((scenario_id, arm_name), []).append(result)
    lines = [
        "| scenario | arm | runs | process | outcome | cost $ | opus share | main tool calls | spawns (role:model/effort) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]

    def mean(values):
        values = [v for v in values if v is not None]
        return round(sum(values) / len(values), 2) if values else "-"

    for (scenario_id, arm_name), runs in sorted(rows.items()):
        spawns = "; ".join(", ".join(r["metrics"]["spawns"]) or "none" for r in runs)
        lines.append(
            f"| {scenario_id} | {arm_name} | {len(runs)} "
            f"| {mean([r['summary']['process_pass_rate'] for r in runs])} "
            f"| {mean([r['summary']['outcome_pass_rate'] for r in runs])} "
            f"| {mean([r['metrics']['cost_usd'] for r in runs])} "
            f"| {mean([r['metrics']['opus_share'] for r in runs])} "
            f"| {mean([sum(r['metrics']['main_tool_calls'].values()) for r in runs])} | {spawns} |"
        )
    failures = [
        f"- {sid} / {arm} rep: {e['text']} — {e['evidence']}"
        for sid, arm, r in results for e in r["expectations"] if not e["passed"]
    ]
    text = "\n".join(lines) + "\n\n## Failed checks\n\n" + ("\n".join(failures) or "none") + "\n"
    (out / "summary.md").write_text(text)
    print("\n" + text)


def main():
    config = json.loads((HERE / "scenarios.json").read_text())
    by_id = {s["id"]: s for s in config["scenarios"]}
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-s", "--scenarios", default=",".join(by_id), help="comma-separated scenario ids")
    parser.add_argument("-a", "--arms", default="skill,baseline", help=f"comma-separated, from {', '.join(config['arms'])}")
    parser.add_argument("-n", "--reps", type=int, default=1)
    parser.add_argument("-j", "--jobs", type=int, default=1, help="runs in parallel (they share one rate limit)")
    parser.add_argument("-o", "--out", type=pathlib.Path, default=HERE / "results" / time.strftime("%Y%m%d-%H%M%S"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--regrade", type=pathlib.Path, metavar="DIR", help="re-grade every run under a results dir and rewrite its summary")
    args = parser.parse_args()
    args.out = args.out.resolve()

    if args.regrade:
        results = []
        for meta_path in sorted(args.regrade.glob("*/*/rep-*/meta.json")):
            meta = json.loads(meta_path.read_text())
            result = grade.grade(meta_path.parent, by_id[meta["scenario"]], config["arms"][meta["arm"]])
            results.append((meta["scenario"], meta["arm"], result))
        summarize(args.regrade, results)
        return

    for name in args.arms.split(","):
        arm = config["arms"][name]
        if arm["skill"]:
            arm["source"] = skill_source(arm.get("ref"), arm.get("folder"))
    jobs = []
    for sid in args.scenarios.split(","):
        scenario = by_id[sid]
        prompt = scenario.get("prompt") or by_id[scenario["prompt_from"]]["prompt"]
        for arm_name in args.arms.split(","):
            for rep in range(1, args.reps + 1):
                jobs.append((scenario, arm_name, config["arms"][arm_name], rep, prompt))
    budget = sum(s.get("budget_usd", 5) for s, *_ in jobs)
    print(f"{len(jobs)} runs, worst-case spend ${budget} (sum of --max-budget-usd caps) -> {args.out}", file=sys.stderr)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(run_one, args.out, s, an, a, rep, p, args.dry_run) for s, an, a, rep, p in jobs]
        results = [f.result() for f in futures]
    if not args.dry_run:
        summarize(args.out, [r for r in results if r])


if __name__ == "__main__":
    main()
