"""Split a run's cost and context between the main thread and its subagents.

    python3 threads.py results/<batch> [results/<batch> ...]

Reads per-message usage from each trace (deduplicated by message id), prices it, and
reports for each run: main-thread vs subagent cost, how much of each was cache reads,
cache writes, fresh input and output, the main thread's final context size, and speed
(wall-clock, time waiting on the model, summed subagent time). That
context is what every follow-up turn in the same session re-reads, so it sets the cost
of continuing the conversation after the task.
"""

import json
import pathlib
import sys

# $/MTok: input, output, cache read. Cache writes are 1.25x input (5 min) and 2x input (1 h).
PRICES = {"opus": (4.0, 20.0, 0.20), "sonnet": (2.0, 10.0, 0.20), "haiku": (0.10, 0.50, 0.01)}


def family(model):
    return next((f for f in PRICES if f in (model or "")), None)


def thread_usage(trace):
    """{thread: {model family: summed usage}} where thread is 'main' or 'sub'."""
    seen = {}
    for line in open(trace, errors="replace"):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("type") != "assistant" or not e["message"].get("usage"):
            continue
        m = e["message"]
        key = m.get("id")
        u = m["usage"]
        prev = seen.get(key)
        # a message streams as several events; keep the one with the most output
        if prev is None or u.get("output_tokens", 0) >= prev[2].get("output_tokens", 0):
            seen[key] = ("sub" if e.get("parent_tool_use_id") else "main", m.get("model"), u)
    out = {}
    last_main_context = 0
    for thread, model, u in seen.values():
        fam = family(model)
        slot = out.setdefault(thread, {}).setdefault(fam, {"in": 0, "out": 0, "read": 0, "w5": 0, "w1h": 0, "msgs": 0})
        cc = u.get("cache_creation") or {}
        slot["in"] += u.get("input_tokens", 0)
        slot["out"] += u.get("output_tokens", 0)
        slot["read"] += u.get("cache_read_input_tokens", 0)
        slot["w5"] += cc.get("ephemeral_5m_input_tokens", 0)
        slot["w1h"] += cc.get("ephemeral_1h_input_tokens", 0)
        slot["msgs"] += 1
        if thread == "main":
            ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
            last_main_context = max(last_main_context, ctx)
    return out, last_main_context


def price(fam, s):
    i, o, r = PRICES[fam]
    parts = {
        "read": s["read"] * r,
        "write": s["w5"] * i * 1.25 + s["w1h"] * i * 2,
        "input": s["in"] * i,
        "output": s["out"] * o,
    }
    return {k: v / 1e6 for k, v in parts.items()}


def fix_output(usage, trace):
    """Streamed events snapshot output_tokens at the start of each message, so take output
    totals per model from the run's result event and split them across threads by each
    thread's share of that model's messages. Input and cache counts per message are exact."""
    result = {}
    for line in open(trace, errors="replace"):
        if '"type": "result"' in line or '"type":"result"' in line:
            try:
                result = json.loads(line)
            except json.JSONDecodeError:
                pass
    usage["_result"] = result
    for model, mu in (result.get("modelUsage") or {}).items():
        fam = family(model)
        slots = [usage[t][fam] for t in usage if fam in usage[t]]
        msgs = sum(sl["msgs"] for sl in slots) or 1
        for sl in slots:
            sl["out"] = mu.get("outputTokens", 0) * sl["msgs"] / msgs


def analyze(run_dir):
    run_dir = pathlib.Path(run_dir)
    usage, context = thread_usage(run_dir / "trace.jsonl")
    fix_output(usage, run_dir / "trace.jsonl")
    result = usage.pop("_result")
    subagent_s = 0.0
    for line in open(run_dir / "trace.jsonl", errors="replace"):
        if "task_notification" in line:
            try:
                subagent_s += ((json.loads(line).get("usage") or {}).get("duration_ms") or 0) / 1000
            except json.JSONDecodeError:
                pass
    meta = json.loads((run_dir / "meta.json").read_text())
    grading = json.loads((run_dir / "grading.json").read_text())
    row = {"scenario": meta["scenario"], "arm": meta["arm"], "rep": meta["rep"],
           "reported_cost": grading["metrics"]["cost_usd"], "main_context_tokens": context,
           # wall: the whole claude run; api: time waiting on the model; subagents: summed subagent run time
           "wall_s": meta.get("wall_s"), "api_s": round((result.get("duration_api_ms") or 0) / 1000, 1),
           "subagent_s": round(subagent_s, 1)}
    for thread in ("main", "sub"):
        total = {"read": 0, "write": 0, "input": 0, "output": 0}
        for fam, s in usage.get(thread, {}).items():
            for k, v in price(fam, s).items():
                total[k] += v
        row[thread] = {k: round(v, 4) for k, v in total.items()}
        row[thread]["total"] = round(sum(total.values()), 4)
    # one follow-up turn re-reads the main context: from cache if it's warm (within the 1 h TTL), else rewritten
    i, _, r = PRICES["opus"]
    row["followup_reread_warm"] = round(context * r / 1e6, 4)
    row["followup_reread_cold"] = round(context * i * 2 / 1e6, 4)
    return row


if __name__ == "__main__":
    rows = [analyze(m.parent) for b in sys.argv[1:] for m in sorted(pathlib.Path(b).glob("*/*/rep-*/meta.json"))]
    print(json.dumps(rows, indent=1))
