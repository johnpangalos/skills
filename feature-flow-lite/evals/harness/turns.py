"""List the main thread's turns and count full-suite runs per build.

    python3 turns.py results/<batch> [results/<batch> ...]          # one summary row per run
    python3 turns.py -v results/<batch>/<scenario>/<arm>/rep-1       # every main-thread turn

A turn is one model call in the main thread (one assistant message id). Its wait is the time
from the event that started it (a tool result, a task notification, or the previous turn) to
its last streamed block, so idle time spent waiting on background agents isn't counted (a
notification's arrival is taken from the task's end_time). The first turn has no start event and
counts as 0. Each
turn is labelled by what it did: spawn:<role>, read (Read/Grep/Glob), check (a full test or
lint run), bash (any other command), wait (ReadNotifications, TaskOutput, sleep), or text.

Full-suite runs are Bash commands that run the whole test suite: the scenario's own patterns
(the playdate playtests, vitest, pytest, go test, cargo test) with no single test file named.
"""

import argparse
import datetime
import json
import pathlib
import re
import statistics

SUITE = re.compile(r"//playtests:test|vp test run|vitest run|\bpytest\b|go test \./\.\.\.|cargo test")
ONE_FILE = re.compile(r"\.test\.ts\b|_spec\.lua\b|tests?/\S+\.(py|ts|lua)\b|-t ['\"]|--grep|::|-run ")
CHECK = re.compile(r"mise run|stylua|luacheck|pytest|go test|go vet|cargo|ruff|mypy|vitest|vp (test|check)|tsc\b")
WAIT_TOOLS = {"ReadNotifications", "TaskOutput", "Monitor"}


def ts(event):
    s = event.get("timestamp")
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() if s else None


def is_full_suite(cmd):
    return bool(SUITE.search(cmd)) and not ONE_FILE.search(cmd)


def label(blocks):
    kinds = []
    for b in blocks:
        if b.get("type") != "tool_use":
            continue
        name, args = b["name"], b.get("input") or {}
        if name in ("Agent", "Task"):
            kinds.append("spawn:" + (args.get("subagent_type") or "?").split(":")[-1])
        elif name in ("Read", "Grep", "Glob"):
            kinds.append("read")
        elif name in WAIT_TOOLS:
            kinds.append("wait")
        elif name == "Bash":
            cmd = args.get("command", "")
            if re.match(r"\s*sleep\b", cmd):
                kinds.append("wait")
            elif CHECK.search(cmd):
                kinds.append("check" + ("(full)" if is_full_suite(cmd) else ""))
            else:
                kinds.append("bash")
        else:
            kinds.append(name)
    return ",".join(kinds) or "text"


def analyze(run_dir):
    run_dir = pathlib.Path(run_dir)
    turns = {}  # message id -> turn
    order = []
    last_main = None  # timestamp of the previous main-thread event
    last_any = None  # latest timestamp in either thread
    suite = {"main": 0, "sub": 0}
    result = {}
    for line in open(run_dir / "trace.jsonl", errors="replace"):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("type") == "result":
            result = e
        if e.get("type") == "system" and e.get("subtype") in ("task_updated", "task_notification"):
            # a background task woke the main thread: system events carry no timestamp, so take the
            # task's end_time when it has one, else the latest event before the notification
            end = ((e.get("patch") or {}).get("end_time") or 0) / 1000 or last_any
            if end and (last_main is None or end > last_main):
                last_main = end
            continue
        if ts(e):
            last_any = max(last_any or 0, ts(e))
        if e.get("type") not in ("assistant", "user"):
            continue
        sub = bool(e.get("parent_tool_use_id"))
        blocks = e["message"].get("content")
        blocks = blocks if isinstance(blocks, list) else []
        if e["type"] == "assistant":
            for b in blocks:
                if b.get("type") == "tool_use" and b["name"] == "Bash" and is_full_suite((b.get("input") or {}).get("command", "")):
                    suite["sub" if sub else "main"] += 1
        if sub:
            continue
        t = ts(e)
        if e["type"] == "user":
            last_main = t or last_main
            continue
        mid = e["message"].get("id")
        if mid not in turns:
            turns[mid] = {"start": last_main, "end": t, "blocks": [], "text": ""}
            order.append(mid)
        turn = turns[mid]
        turn["end"] = t or turn["end"]
        turn["blocks"] += blocks
        turn["text"] += " ".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        last_main = t or last_main
    rows = []
    for mid in order:
        turn = turns[mid]
        wait = (turn["end"] - turn["start"]) if turn["start"] and turn["end"] else None
        rows.append({"label": label(turn["blocks"]), "wait_s": round(wait, 1) if wait is not None else None,
                     "text": turn["text"].strip().replace("\n", " ")[:160]})
    meta_path = run_dir / "meta.json"  # written when the run ends; a live run is named from its path
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {
        "scenario": run_dir.parent.parent.name, "arm": run_dir.parent.name, "rep": int(run_dir.name.split("-")[1])}
    return {
        "scenario": meta["scenario"], "arm": meta["arm"], "rep": meta["rep"], "wall_s": meta.get("wall_s"),
        "api_s": round((result.get("duration_api_ms") or 0) / 1000, 1),
        "main_turns": len(rows), "main_wait_s": round(sum(r["wait_s"] or 0 for r in rows), 1),
        "suite_main": suite["main"], "suite_sub": suite["sub"], "turns": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dirs", nargs="+", type=pathlib.Path, help="batches, or single run dirs with -v")
    parser.add_argument("-v", "--verbose", action="store_true", help="print every main-thread turn")
    args = parser.parse_args()
    runs = []
    for d in args.dirs:
        traces = [d / "trace.jsonl"] if (d / "trace.jsonl").exists() else sorted(d.glob("*/*/rep-*/trace.jsonl"))
        runs += [analyze(t.parent) for t in traces]
    print(f"{'scenario':<20} {'arm':<14} rep {'wall':>6} {'api':>6} {'turns':>5} {'mainwait':>8} suite(main/sub)")
    for r in runs:
        print(f"{r['scenario']:<20} {r['arm']:<14} {r['rep']:>3} {r['wall_s'] or 0:>6.0f} {r['api_s']:>6.0f} "
              f"{r['main_turns']:>5} {r['main_wait_s']:>8.0f} {r['suite_main']}/{r['suite_sub']}")
        if args.verbose:
            for i, t in enumerate(r["turns"], 1):
                print(f"   {i:>2} {t['wait_s'] if t['wait_s'] is not None else '-':>6}s {t['label']:<28} {t['text']}")
    by_arm = {}
    for r in runs:
        by_arm.setdefault((r["scenario"], r["arm"]), []).append(r)
    print()
    for (sid, arm), rs in sorted(by_arm.items()):
        mean = lambda k: statistics.mean(r[k] or 0 for r in rs)
        print(f"{sid:<20} {arm:<14} n={len(rs)} wall {mean('wall_s'):.0f}s api {mean('api_s'):.0f}s turns {mean('main_turns'):.1f} "
              f"main wait {mean('main_wait_s'):.0f}s suite {mean('suite_main'):.1f}/{mean('suite_sub'):.1f}")


if __name__ == "__main__":
    main()
