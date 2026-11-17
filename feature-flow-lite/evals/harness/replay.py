#!/usr/bin/env python3
"""Reviewer replay: run two reviewer prompts against fixed final diffs with known bugs, and clean ones.

For each selected build (replay-set.json): rebuild the tree from the scenario's setup plus the
build's diff.patch (as run.prepare does), take the build's first reviewer handoff from its trace,
and run each reviewer 3 times on Haiku at medium effort with only Read, Grep, Glob and Bash:

  a  the 0.2 reviewer        (git show 9f82cef:feature-flow-lite/agents/reviewer.md)
  b  the candidate reviewer  (variants/candidate-0.5/agents/reviewer.md), with TRIGGERED CHECKS:
     picked once per diff by one Opus call that follows step 6 of variants/candidate-0.5/SKILL.md,
     plus APPROVED DIFFERENCES: for chi-etag.

Then score with recall.py's sonnet matcher: recall, whether the matching finding is [blocking],
and on clean diffs every [blocking] finding (verified by hand afterwards, see REPLAY.md).

    python3 replay.py select            # writes replay-set.json from recall.json + judges
    python3 replay.py rekey --add chi-etag:lite-tests-first:3   # keys from probes/keys-round2.json
    python3 replay.py triggers          # the Opus pick per diff -> replay-triggers.json
    python3 replay.py run --jobs 3      # every (diff, reviewer, rep) -> replay-runs/
    python3 replay.py score             # replay.json + the tables for REPLAY.md
"""
import argparse
import concurrent.futures as cf
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import recall  # noqa: E402
import run as runmod  # noqa: E402

OUT = HERE / "replay-runs"
SCRATCH = Path(os.environ.get("REPLAY_SCRATCH", tempfile.gettempdir())) / "ff-replay"
REPS = 3
UNRELIABLE_KEYS = {("chi-etag", "flush-bypass")}
APPROVED = {"chi-etag": "Flush must not send bytes before the response completes."}


def scenarios():
    data = json.load(open(HERE / "scenarios.json"))
    items = data if isinstance(data, list) else data.get("scenarios", list(data.values()))
    return {s["id"]: s for s in items}


def reviewer_body(which):
    if which == "a":
        text = subprocess.run(["git", "show", "9f82cef:feature-flow-lite/agents/reviewer.md"], cwd=HERE,
                              capture_output=True, text=True, check=True).stdout
    else:
        text = (HERE / "variants/candidate-0.5/agents/reviewer.md").read_text()
    return re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S).strip()


def first_review_handoff(build_dir):
    trace = recall.load_trace(HERE / build_dir)
    for s in trace.main_spawns:
        if s["role"] == "reviewer":
            return s["prompt"]
    raise ValueError(f"no reviewer in {build_dir}")


# --- select -------------------------------------------------------------------------------

def cmd_select(args):
    """Pick the keyed-bug diffs (spread over tasks and keys) and clean diffs (no confirmed defects, top rank)."""
    rows = json.load(open(HERE / "recall.json"))
    # flush-bypass: the round-2 judges penalised the opposite behaviour (Flush buffered), so its
    # judge-based "present" is not trustworthy; leave it out of the bug picks (see REPLAY.md)
    present = [r for r in rows if r["present"] and (r["task"], r["key"]) not in UNRELIABLE_KEYS]
    by_key = defaultdict(list)
    for r in present:
        by_key[(r["task"], r["key"])].append(r)
    # round-robin over keys so tasks and keys are spread; prefer builds whose own reviewer missed it
    picked, seen_builds = [], set()
    order = sorted(by_key, key=lambda k: (recall.TASKS.index(k[0]), k[1]))
    while len(picked) < args.bugs and any(by_key.values()):
        for k in order:
            cands = [r for r in by_key[k] if r["dir"] not in seen_builds]
            cands.sort(key=lambda r: (r["found"], recall.ARMS.index(r["arm"]), r["rep"]))
            if cands and len(picked) < args.bugs and sum(p["task"] == k[0] for p in picked) < args.per_task:
                r = cands[0]
                picked.append({"kind": "bug", "task": r["task"], "arm": r["arm"], "rep": r["rep"], "dir": r["dir"],
                               "keys": sorted({x["key"] for x in present if x["dir"] == r["dir"]}),
                               "original_reviewer_found": r["found"]})
                seen_builds.add(r["dir"])
            by_key[k] = [r for r in by_key[k] if r["dir"] not in seen_builds]
        if all(not v or sum(p["task"] == k[0] for p in picked) >= args.per_task for k, v in by_key.items()):
            break
    # clean: only website-bookshop has builds with zero confirmed defects from both judges; every
    # other hard-task build has at least two (mostly minor). So: the top 2 strictly clean bookshop
    # builds, plus, for chi-etag, ui-lib, risky-auth and risky-refunds, the top-ranked build with no
    # keyed bug present ("keyed-clean"; its minor confirmed defects are listed for checking findings).
    ranks = recall.judge_rank()
    defects = recall.judge_defects()
    keyed_present = {(r["task"], r["arm"], r["rep"]) for r in rows if r["present"]}
    clean = []
    for (task, arm, rep), (score, letter, n) in sorted(ranks.items(), key=lambda kv: -kv[1][0]):
        if task not in recall.TASKS or arm not in recall.ARMS or task == "rac-shadow-hide":
            continue
        strict = task == "website-bookshop"
        if (strict and n) or (task, arm, rep) in keyed_present or sum(c["task"] == task for c in clean) >= (2 if strict else 1):
            continue
        dirs = sorted(recall.DATA.glob(f"*/{task}/{arm}/rep-{rep}"))
        clean.append({"kind": "clean", "task": task, "arm": arm, "rep": rep, "dir": str(dirs[0].relative_to(HERE)),
                      "keys": [], "judge_score": score, "letter": letter, "strict": strict,
                      "judge_confirmed_defects": defects.get((task, arm, rep), [])})
    json.dump(picked + clean, open(HERE / "replay-set.json", "w"), indent=1)
    for p in picked + clean:
        print(p["kind"], p["task"], p["arm"], p["rep"], p["keys"], p.get("judge_score", ""))


def cmd_rekey(args):
    """Re-derive each item's keys from the deterministic probes (probes/keys-round2.json), after they landed.

    A "clean" pick with a probe-failing key becomes a bug item; --add task:arm:rep appends keyed-clean picks."""
    items = json.load(open(HERE / "replay-set.json"))
    failing = recall.probe_failing()
    defects = recall.judge_defects()
    ranks = recall.judge_rank()
    for spec in filter(None, args.add.split(",")):
        task, arm, rep = spec.split(":")
        d = sorted(recall.DATA.glob(f"*/{task}/{arm}/rep-{rep}"))[0]
        items.append({"kind": "clean", "task": task, "arm": arm, "rep": int(rep), "dir": str(d.relative_to(HERE)), "keys": [],
                      "judge_score": ranks[(task, arm, int(rep))][0], "letter": ranks[(task, arm, int(rep))][1], "strict": False,
                      "judge_confirmed_defects": defects.get((task, arm, int(rep)), []), "added_after_probes": True})
    for i in items:
        if i["task"] == "website-bookshop":
            continue  # no keys for this task
        keys = sorted(failing[(i["task"], i["arm"], i["rep"])])
        if keys != i["keys"]:
            print(f"{item_id(i)}: {i['kind']} {i['keys']} -> {'bug' if keys else 'clean'} {keys}")
        i["judge_keys"] = i["keys"]
        i["keys"] = keys
        if keys and i["kind"] == "clean":
            i["kind"], i["was_clean_by_judges"] = "bug", True
        elif not keys and i["kind"] == "bug":
            i["kind"] = "clean"
    json.dump(items, open(HERE / "replay-set.json", "w"), indent=1)


# --- workspace ----------------------------------------------------------------------------

def build_tree(item, dest):
    sc = scenarios()[item["task"]]
    if dest.exists():
        shutil.rmtree(dest)
    os.environ["FIXTURES"] = str(runmod.FIXTURES)
    runmod.prepare(dest, sc, {"skill": None})
    patch = HERE / item["dir"] / "diff.patch"
    subprocess.run(["git", "apply", "--whitespace=nowarn", str(patch)], cwd=dest, check=True)
    subprocess.run(["git", "add", "-A", "-N", "."], cwd=dest, check=True)


def reset_tree(item, dest):
    """Undo whatever a reviewer left behind: back to base, then the diff again (ignored installs kept)."""
    subprocess.run(["git", "reset", "-q", "--hard", "HEAD"], cwd=dest, check=True)
    subprocess.run(["git", "clean", "-qfd"], cwd=dest, check=True)
    patch = HERE / item["dir"] / "diff.patch"
    subprocess.run(["git", "apply", "--whitespace=nowarn", str(patch)], cwd=dest, check=True)
    subprocess.run(["git", "add", "-A", "-N", "."], cwd=dest, check=True)


def item_id(item):
    return f"{item['task']}--{item['arm']}--rep-{item['rep']}"


def handoff_for(item, which, workspace, triggers):
    text = first_review_handoff(item["dir"])
    text = re.sub(r"/tmp/ff-eval-[A-Za-z0-9_]+/workspace", str(workspace), text)
    if which == "b":
        extra = []
        if item["task"] in APPROVED:
            extra.append(f"APPROVED DIFFERENCES: {APPROVED[item['task']]}")
        extra.append("TRIGGERED CHECKS:\n" + triggers[item_id(item)]["text"])
        text = text.rstrip() + "\n\n" + "\n\n".join(extra) + "\n"
    return text


# --- triggers -----------------------------------------------------------------------------

def cmd_triggers(args):
    items = json.load(open(HERE / "replay-set.json"))
    path = HERE / "replay-triggers.json"
    done = json.load(open(path)) if path.exists() else {}
    skill = (HERE / "variants/candidate-0.5/SKILL.md").read_text()
    step6 = re.search(r"^6\. \*\*Reviewer\*\*.*?(?=^7\. )", skill, re.M | re.S).group(0)
    checks = (HERE / "variants/candidate-0.5/references/checks.md").read_text()

    def one(item):
        diff = (HERE / item["dir"] / "diff.patch").read_text()
        if len(diff) > 120_000:
            diff = diff[:120_000] + "\n[... diff truncated ...]\n"
        handoff = first_review_handoff(item["dir"])
        crit = re.search(r"ACCEPTANCE CRITERIA:.*?(?=^\s*(Extra hostile|CHECKS:|PROJECT CHECKLIST:)|\Z)", handoff, re.M | re.S)
        prompt = f"""You are the main conversation of the feature-flow-lite skill, at this step:

{step6}
Here is references/checks.md:

<checks.md>
{checks}
</checks.md>

The acceptance criteria you wrote for this change:

<criteria>
{crit.group(0) if crit else handoff}
</criteria>

The diff:

<diff>
{diff}
</diff>

Do only the TRIGGERED CHECKS part of step 6: read the diff against references/checks.md and copy every item whose trigger matches, word for word (its Trigger, Check and From lines, with its heading). Output only the text that goes after `TRIGGERED CHECKS:` in the reviewer's handoff, nothing else."""
        proc = subprocess.run(["claude", "-p", "--model", "opus", "--tools", "", "--output-format", "json",
                               "--no-session-persistence", "--setting-sources", ""],
                              input=prompt, capture_output=True, text=True, timeout=900, cwd="/tmp")
        outer = json.loads(proc.stdout)
        text = outer["result"].strip()
        heads = re.findall(r"^#+\s*(.+)$", text, re.M)
        return item_id(item), {"text": text, "headings": heads, "cost": outer.get("total_cost_usd")}

    todo = [i for i in items if item_id(i) not in done]
    with cf.ThreadPoolExecutor(4) as ex:
        for k, v in ex.map(one, todo):
            done[k] = v
            print(k, v["headings"], f"${v['cost']:.3f}")
            json.dump(done, open(path, "w"), indent=1)


# --- run ----------------------------------------------------------------------------------

def run_reviewer(item, which, rep, workspace, triggers):
    rdir = OUT / item_id(item) / which / f"rep-{rep}"
    if (rdir / "result.json").exists():
        return json.load(open(rdir / "result.json"))
    rdir.mkdir(parents=True, exist_ok=True)
    reset_tree(item, workspace)
    handoff = handoff_for(item, which, workspace, triggers)
    (rdir / "handoff.txt").write_text(handoff)
    cmd = ["claude", "-p", "--model", "haiku", "--effort", "medium",
           "--system-prompt", reviewer_body(which),
           "--tools", "Read,Grep,Glob,Bash", "--allowedTools", "Read,Grep,Glob,Bash",
           "--permission-mode", "acceptEdits", "--permission-prompts", "none",
           "--output-format", "stream-json", "--verbose", "--no-session-persistence",
           "--max-budget-usd", "5"]
    env = {k: v for k, v in os.environ.items() if k not in runmod.SCRUB}
    started = time.time()
    with open(rdir / "trace.jsonl", "w") as trace, open(rdir / "stderr.txt", "w") as err:
        try:
            subprocess.run(cmd, input=handoff, cwd=workspace, env=env, stdout=trace, stderr=err, text=True, timeout=2400)
        except subprocess.TimeoutExpired:
            err.write("\nreplay: timed out\n")
    events = recall.load_events(rdir / "trace.jsonl")
    result_ev = next((e for e in reversed(events) if e.get("type") == "result"), {})
    texts = [b["text"] for e in events if e.get("type") == "assistant" and not e.get("parent_tool_use_id")
             for b in e["message"].get("content") or [] if b.get("type") == "text"]
    out = {"item": item_id(item), "reviewer": which, "rep": rep, "cost": result_ev.get("total_cost_usd"),
           "wall_s": round(time.time() - started, 1), "num_turns": result_ev.get("num_turns"),
           "final": result_ev.get("result") or (texts[-1] if texts else "")}
    json.dump(out, open(rdir / "result.json", "w"), indent=1)
    subprocess.run(["gzip", "-f", str(rdir / "trace.jsonl")])
    return out


def cmd_run(args):
    items = json.load(open(HERE / "replay-set.json"))
    if args.only:
        items = [i for i in items if any(o in item_id(i) for o in args.only.split(","))]
    triggers = json.load(open(HERE / "replay-triggers.json"))
    SCRATCH.mkdir(parents=True, exist_ok=True)

    def per_item(item):
        ws = SCRATCH / item_id(item) / "workspace"
        if not (ws / ".git").exists():
            build_tree(item, ws)
        results = []
        for rep in range(1, REPS + 1):
            for which in ("a", "b"):
                r = run_reviewer(item, which, rep, ws, triggers)
                print(f"{item_id(item)} {which} rep-{rep} ${r['cost'] or 0:.3f} {r['wall_s']}s", flush=True)
                results.append(r)
        if not args.keep:
            shutil.rmtree(ws.parent, ignore_errors=True)
        return results

    with cf.ThreadPoolExecutor(args.jobs) as ex:
        futs = {ex.submit(per_item, i): i for i in items}
        for f in cf.as_completed(futs):
            try:
                f.result()
            except Exception as e:  # noqa: BLE001
                print(f"FAILED {item_id(futs[f])}: {e}", flush=True)


# --- score --------------------------------------------------------------------------------

def blocking_findings(final):
    sec = recall.findings_section(final)
    items = re.split(r"\n\s*[-*]\s+|\n\s*\d+\.\s+", "\n" + sec)
    return [i.strip() for i in items if re.search(r"\[blocking\]", i, re.I)]


def match_replay(key_text, final):
    prompt = f"""You are matching code-review findings against a known bug. Reply with ONLY a JSON object.

KNOWN BUG: {key_text}

{recall.MATCH_RULES}

=== REVIEW FINDINGS ===
{recall.findings_section(final) or '(empty)'}

Reply exactly:
{{"found": "yes"|"no", "finding_quote": "<verbatim quote of the matching finding, or empty>", "blocking": "yes"|"no"}}
"blocking" is "yes" only if the matching finding is tagged [blocking]."""
    return recall.ask_sonnet(prompt, "replay")


def cmd_score(args):
    keys = {k: v for k, v in json.load(open(HERE / "probes" / "keys.json")).items() if not k.startswith("_")}
    items = {item_id(i): i for i in json.load(open(HERE / "replay-set.json"))}
    rows = []
    jobs = []
    for res_path in sorted(OUT.glob("*/*/rep-*/result.json")):
        r = json.load(open(res_path))
        item = items.get(r["item"])
        if not item:
            continue
        base = {"item": r["item"], "kind": item["kind"], "task": item["task"], "reviewer": r["reviewer"], "rep": r["rep"],
                "cost": r["cost"], "wall_s": r["wall_s"], "blocking": blocking_findings(r["final"]),
                "empty": not r["final"].strip()}
        if item["kind"] == "bug":
            for k in item["keys"]:
                jobs.append((dict(base, key=k), keys[item["task"]][k], r["final"]))
        else:
            rows.append(dict(base, key=None))
    with cf.ThreadPoolExecutor(8) as ex:
        for row, m in zip([j[0] for j in jobs], ex.map(lambda j: match_replay(j[1], j[2]), jobs)):
            row.update(found=m["found"] == "yes", found_blocking=m["found"] == "yes" and m["blocking"] == "yes",
                       finding_quote=m.get("finding_quote", ""))
            rows.append(row)
    rows.sort(key=lambda r: (r["item"], r["reviewer"], r["rep"], r["key"] or ""))
    json.dump(rows, open(HERE / "replay.json", "w"), indent=1)
    # summary
    for which in ("a", "b"):
        bug = [r for r in rows if r["reviewer"] == which and r["kind"] == "bug"]
        clean = [r for r in rows if r["reviewer"] == which and r["kind"] == "clean"]
        runs = {(r["item"], r["rep"]): r["cost"] or 0 for r in rows if r["reviewer"] == which}
        print(f"reviewer {which}: recall {sum(r['found'] for r in bug)}/{len(bug)}, blocking recall "
              f"{sum(r['found_blocking'] for r in bug)}/{len(bug)}, clean blocking findings "
              f"{sum(len(r['blocking']) for r in clean)} over {len(clean)} runs, mean cost ${sum(runs.values()) / max(1, len(runs)):.3f}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("select")
    s.add_argument("--bugs", type=int, default=10)
    s.add_argument("--clean", type=int, default=6)
    s.add_argument("--per-task", type=int, default=3)
    k = sub.add_parser("rekey")
    k.add_argument("--add", default="")
    sub.add_parser("triggers")
    r = sub.add_parser("run")
    r.add_argument("--jobs", type=int, default=3)
    r.add_argument("--only", default="")
    r.add_argument("--keep", action="store_true")
    sub.add_parser("score")
    args = ap.parse_args()
    {"select": cmd_select, "rekey": cmd_rekey, "triggers": cmd_triggers, "run": cmd_run, "score": cmd_score}[args.cmd](args)


if __name__ == "__main__":
    main()
