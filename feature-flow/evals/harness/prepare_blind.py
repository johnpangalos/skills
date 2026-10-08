"""Copy one or more batches' workspaces into anonymized folders for blind judging.

    python3 prepare_blind.py /tmp/ff-judge results/<batch> [results/<batch> ...]

Each run's workspace lands in <dest>/<scenario>/<letter>/ without .claude, build output, or
anything else that names the arm. Letters are shuffled per scenario by a hash of the run path,
so they don't follow arm order. For runs on an existing repo (a workspace with prior history),
git history is kept and the change is also written to <letter>.diff. Websites get desktop and
no-JS mobile screenshots in <letter>-shots/. The letter -> arm mapping goes to
<first batch>/blind-mapping.json, outside the judges' folders.
"""

import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
BUILD_OUTPUT = ("target", "bin", "node_modules", "__pycache__", ".ruff_cache", ".turbo", "dist")


def has_history(workspace):
    out = subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=workspace, capture_output=True, text=True)
    return out.returncode == 0 and int(out.stdout.strip() or 0) > 1


def main(dest, *batches):
    dest = pathlib.Path(dest).resolve()
    by_scenario = {}
    for batch in batches:
        for meta_path in sorted(pathlib.Path(batch).resolve().glob("*/*/rep-*/meta.json")):
            meta = json.loads(meta_path.read_text())
            by_scenario.setdefault(meta["scenario"], []).append((meta_path.parent, meta))
    mapping = {}
    for scenario, runs in by_scenario.items():
        runs.sort(key=lambda r: hashlib.sha256(str(r[0]).encode()).hexdigest())
        for letter, (run_dir, meta) in zip("ABCDEFGHIJKL", runs):
            workspace = pathlib.Path(meta["workspace"])
            keep_git = has_history(workspace)
            target = dest / scenario / letter
            shutil.rmtree(target, ignore_errors=True)
            drop = BUILD_OUTPUT + (".claude",) + (() if keep_git else (".git",))
            shutil.copytree(workspace, target, ignore=shutil.ignore_patterns(*drop), symlinks=True)
            if keep_git:
                diff = subprocess.run("git add -A -N . && git diff HEAD", shell=True, cwd=target, capture_output=True, text=True).stdout
                (dest / scenario / f"{letter}.diff").write_text(diff)
            if scenario.startswith("website"):
                shots = dest / scenario / f"{letter}-shots"
                shots.mkdir(parents=True, exist_ok=True)
                subprocess.run(["node", str(HERE / "hidden" / "website-bookshop" / "render.js"), str(target), str(shots)], capture_output=True)
            grading = json.loads((run_dir / "grading.json").read_text())
            mapping.setdefault(scenario, {})[letter] = {
                "arm": meta["arm"],
                "rep": meta["rep"],
                "run_dir": str(run_dir),
                "cost_usd": grading["metrics"]["cost_usd"],
                "outcome_pass_rate": grading["summary"]["outcome_pass_rate"],
            }
    out = pathlib.Path(batches[0]).resolve() / "blind-mapping.json"
    out.write_text(json.dumps(mapping, indent=2))
    print(json.dumps({s: sorted(m) for s, m in mapping.items()}), "->", out)


if __name__ == "__main__":
    main(*sys.argv[1:])
