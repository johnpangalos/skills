"""Copy a batch's workspaces into anonymized folders for blind judging.

    python3 prepare_blind.py results/<batch> /tmp/ff-judge

Each run's workspace lands in <dest>/<scenario>/<letter>/ without .git, .claude,
build output, or anything else that names the arm. Letters are shuffled per
scenario by a hash of the run path, so they don't follow arm order. Websites
also get desktop and no-JS mobile screenshots in <letter>-shots/. The letter ->
arm mapping goes to <batch>/blind-mapping.json, outside the judges' folders.
"""

import hashlib
import json
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
DROP = shutil.ignore_patterns(".git", ".claude", "target", "bin", "node_modules", "__pycache__", ".ruff_cache")


def main(batch, dest):
    batch, dest = pathlib.Path(batch).resolve(), pathlib.Path(dest).resolve()
    by_scenario = {}
    for meta_path in sorted(batch.glob("*/*/rep-*/meta.json")):
        meta = json.loads(meta_path.read_text())
        by_scenario.setdefault(meta["scenario"], []).append((meta_path.parent, meta))
    mapping = {}
    for scenario, runs in by_scenario.items():
        runs.sort(key=lambda r: hashlib.sha256(str(r[0]).encode()).hexdigest())
        for letter, (run_dir, meta) in zip("ABCDEFGHIJKL", runs):
            target = dest / scenario / letter
            shutil.rmtree(target, ignore_errors=True)
            shutil.copytree(meta["workspace"], target, ignore=DROP)
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
    (batch / "blind-mapping.json").write_text(json.dumps(mapping, indent=2))
    print(json.dumps({s: sorted(m) for s, m in mapping.items()}))


if __name__ == "__main__":
    main(*sys.argv[1:3])
