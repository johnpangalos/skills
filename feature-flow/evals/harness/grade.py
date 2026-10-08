"""Grade one feature-flow run from its stream-json trace and workspace.

Usage: grade.py <run-dir> <scenario-id>   (re-grades a finished run in place)

A run dir holds trace.jsonl (claude -p --output-format stream-json --verbose
--forward-subagent-text) and meta.json, which points at the run's temp workspace
(outcome checks are skipped once that is gone).
Writes grading.json in the skill-creator shape: expectations[] with text /
passed / evidence, a summary, and metrics.
"""

import json
import os
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent

# first match wins, so the specific roles come before the generic ones
ROLE_PATTERNS = [
    ("security", r"secur"),
    ("test_writer", r"test[ -]?writer|write (the )?tests|tests? author"),
    ("planner", r"plann"),
    ("investigator", r"investigat"),
    ("explorer", r"explor|mapper|locat"),
    ("implementor", r"implement"),
    ("simplifier", r"simplif|clean ?up"),
    ("verifier", r"verif|browser.check"),
    ("reviewer", r"review"),
    ("debugger", r"debug"),
    ("docs", r"docs?[ -]?writer|documentation"),
    ("summarizer", r"summari|compact"),
    ("migration", r"migrat"),
]

# models the skill's roster allows per role
ROSTER = {
    "planner": {"opus"},
    "investigator": {"sonnet", "haiku"},
    "explorer": {"haiku"},
    "implementor": {"sonnet"},
    "simplifier": {"haiku", "sonnet"},
    "reviewer": {"sonnet"},
    "verifier": {"haiku"},
    "test_writer": {"sonnet"},
    "debugger": {"sonnet"},
    "docs": {"haiku"},
    "summarizer": {"haiku"},
    "security": {"sonnet"},
    "migration": {"sonnet"},
    "other": {"haiku", "sonnet"},
}

# how the final report may name each role
ROLE_WORDS = {
    "planner": r"plann",
    "investigator": r"investigat",
    "explorer": r"explor",
    "implementor": r"implement",
    "simplifier": r"simplif",
    "verifier": r"verif",
    "reviewer": r"review",
    "test_writer": r"test.?writer",
    "debugger": r"debug",
    "docs": r"docs",
    "summarizer": r"summari|compact",
    "security": r"security",
    "migration": r"migrat",
}

STAGE_WORDS = r"investigat|explor|implement|verif|simplif|review|test.?writer|debug|docs"
CHECK_COMMAND = r"check\.sh|unittest|pytest|ruff|mypy|go (test|vet)|gofmt|cargo (test|clippy|fmt)|vitest|prettier|tsc\b"
EDIT_TOOLS = {"Edit", "Write", "NotebookEdit", "MultiEdit"}


def family(model):
    if not model:
        return "inherit"
    for name in ("opus", "sonnet", "haiku", "fable"):
        if name in model.lower():
            return name
    return model


def load_trace(path):
    events = []
    for line in open(path, encoding="utf-8", errors="replace"):
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return events


class Trace:
    """The parts of a stream-json trace the checks need, in stream order."""

    def __init__(self, events):
        self.spawns = []  # Agent calls, main-level and nested
        self.tools = []  # every tool_use: (idx, name, input, parent)
        self.main_texts = []  # (idx, text) from the main conversation
        self.sub_texts = {}  # spawn id -> [(idx, text)]
        self.sub_models = {}  # spawn id -> model the subagent actually ran on
        self.started = {}  # spawn id -> task_started event
        self.finished = {}  # spawn id -> (idx, task_notification event)
        self.init = None
        self.result = {}
        for idx, e in enumerate(events):
            kind = e.get("type")
            parent = e.get("parent_tool_use_id")
            if kind == "system" and e.get("subtype") == "init" and self.init is None:
                self.init = e
            elif kind == "system" and e.get("subtype") == "task_started":
                self.started[e.get("tool_use_id")] = e
            elif kind == "system" and e.get("subtype") == "task_notification":
                self.finished[e.get("tool_use_id")] = (idx, e)
            elif kind == "result":
                self.result = e
            elif kind == "assistant":
                if parent and e["message"].get("model"):
                    self.sub_models.setdefault(parent, e["message"]["model"])
                for block in e["message"].get("content") or []:
                    if block.get("type") == "text":
                        if parent:
                            self.sub_texts.setdefault(parent, []).append((idx, block["text"]))
                        else:
                            self.main_texts.append((idx, block["text"]))
                    elif block.get("type") == "tool_use":
                        args = block.get("input") or {}
                        self.tools.append((idx, block["name"], args, parent))
                        if block["name"] in ("Agent", "Task"):
                            self.spawns.append(
                                {
                                    "id": block["id"],
                                    "idx": idx,
                                    "parent": parent,
                                    "model": args.get("model"),
                                    "effort": args.get("effort"),
                                    "type": args.get("subagent_type"),
                                    "description": args.get("description") or "",
                                    "prompt": args.get("prompt") or "",
                                }
                            )
        for spawn in self.spawns:
            spawn["role"] = role_of(spawn)
            spawn["family"] = family(self.sub_models.get(spawn["id"]) or spawn["model"])
            spawn["depth"] = (self.started.get(spawn["id"]) or {}).get("spawn_depth")

    @property
    def named_agents_loaded(self):
        return any(a.split(":")[0] in SKILL_PLUGINS for a in (self.init or {}).get("agents") or [] if ":" in a)

    @property
    def main_spawns(self):
        return [s for s in self.spawns if not s["parent"]]

    def of_role(self, role):
        return [s for s in self.main_spawns if s["role"] == role]

    def final_text(self):
        return self.main_texts[-1][1] if self.main_texts else ""

    def returned_text(self, spawn):
        """What a subagent handed back: its last forwarded text block."""
        texts = self.sub_texts.get(spawn["id"])
        if texts:
            return texts[-1][1]
        done = self.finished.get(spawn["id"])
        return done[1].get("summary") or "" if done else ""


# the skill's named agents (agents/*.md), loaded as feature-flow:<agent>
AGENT_ROLES = {
    "investigator": "investigator", "explorer": "explorer", "implementor": "implementor",
    "simplifier": "simplifier", "reviewer": "reviewer", "risky-reviewer": "reviewer",
    "verifier": "verifier", "test-writer": "test_writer", "debugger": "debugger",
    "docs-writer": "docs", "summarizer": "summarizer", "security-reviewer": "security",
    "migration": "migration", "planner": "planner",
}


SKILL_PLUGINS = ("feature-flow", "feature-flow-lite")


def named_agent(spawn):
    plugin, _, agent = (spawn["type"] or "").partition(":")
    return agent if plugin in SKILL_PLUGINS and agent else None


def role_of(spawn):
    if named_agent(spawn) in AGENT_ROLES:
        return AGENT_ROLES[named_agent(spawn)]
    match = re.search(r"^\s*ROLE:\s*(.+)$", spawn["prompt"], re.M)
    text = match.group(1) if match else spawn["description"] + "\n" + spawn["prompt"][:400]
    for role, pattern in ROLE_PATTERNS:
        if re.search(pattern, text, re.I):
            return role
    return "other"


def describe(spawns):
    return ", ".join(f"{s['role']}:{s['family']}" for s in spawns) or "none"


# --- process rules: what the skill says the orchestrator does -------------
# each returns (passed, evidence)


def spawn_models_are_aliases(t, sc, rule):
    bad = [
        s for s in t.spawns
        if s["model"] not in ("opus", "sonnet", "haiku") and not (s["model"] is None and named_agent(s))
    ]
    return not bad, f"unpinned or full-ID spawns: {describe(bad)}" if bad else f"all {len(t.spawns)} spawns pinned"


def named_agents_used(t, sc, rule):
    if not t.named_agents_loaded:
        return True, "named agents not loaded (n/a)"
    bad = [s for s in t.main_spawns if not named_agent(s)]
    return not bad, f"generic spawns: {[s['type'] for s in bad]}" if bad else f"{len(t.main_spawns)} spawns used named agents"


def roles_use_roster_models(t, sc, rule):
    bad = []
    for s in t.main_spawns:
        allowed = set(ROSTER.get(s["role"], ROSTER["other"]))
        if sc.get("_pinned_model"):
            allowed = {sc["_pinned_model"]}  # the arm pins every agent to one model
        if sc.get("risky") and s["role"] == "reviewer":
            allowed.add("opus")
        earlier = [p for p in t.of_role(s["role"]) if p["idx"] < s["idx"]]
        if any(p["effort"] == "high" for p in earlier):
            allowed.add("opus")  # escalation after a failed high-effort retry
        if s["family"] not in allowed:
            bad.append(s)
    return not bad, f"off-roster: {describe(bad)}" if bad else f"on roster: {describe(t.main_spawns)}"


def handoffs_use_template(t, sc, rule):
    bad = []
    for s in t.main_spawns:
        if s["role"] == "planner":
            continue  # the planner gets the user's request as it is
        prompt = (t.started.get(s["id"]) or {}).get("prompt") or s["prompt"]
        need = ["GOAL"] if named_agent(s) else ["ROLE", "GOAL", "RETURN"]
        if s["role"] in ("implementor", "reviewer", "test_writer"):
            need.append("ACCEPTANCE CRITERIA")
        missing = [field for field in need if not re.search(rf"^\W*{field}\b", prompt, re.M | re.I)]
        if missing:
            bad.append(f"{s['role']} missing {'/'.join(missing)}")
    return not bad, "; ".join(bad) if bad else f"{len(t.main_spawns)} handoffs follow the template"


def results_use_template(t, sc, rule):
    limit = rule.get("max_lines", 40)
    bad = []
    for s in t.main_spawns:
        text = t.returned_text(s)
        lines = len(text.strip().splitlines())
        if s["role"] == "planner":  # the planner returns its own template, at up to 60 lines
            if "ACCEPTANCE CRITERIA:" not in text or lines > max(limit, 60):
                bad.append(f"planner returned {lines} lines, ACCEPTANCE CRITERIA {'present' if 'ACCEPTANCE CRITERIA:' in text else 'missing'}")
            continue
        if "STATUS:" not in text:
            bad.append(f"{s['role']} returned no STATUS line")
        elif lines > limit:
            bad.append(f"{s['role']} returned {lines} lines")
    return not bad, "; ".join(bad) if bad else "every subagent returned a STATUS block within budget"


def stages_announced_first(t, sc, rule):
    if not t.main_spawns:
        return True, "no subagents spawned (n/a)"
    first = t.main_spawns[0]["idx"]
    before = " ".join(text for idx, text in t.main_texts if idx < first)
    stages = set(m.lower()[:5] for m in re.findall(STAGE_WORDS, before, re.I))
    return len(stages) >= 2, f"stage words before first spawn: {sorted(stages) or 'none'}"


def checks_before_review(t, sc, rule):
    reviews = t.of_role("reviewer")
    if not reviews:
        return True, "no reviewer spawned (n/a)"
    bad = []
    for r in reviews:
        edits = [idx for idx, name, _, _ in t.tools if name in EDIT_TOOLS and idx < r["idx"]]
        last_edit = max(edits, default=-1)
        ran = [
            idx
            for idx, name, args, _ in t.tools
            if name == "Bash" and re.search(CHECK_COMMAND, args.get("command", "")) and last_edit < idx < r["idx"]
        ]
        verified = [
            t.finished[s["id"]][0]
            for s in t.spawns
            if s["role"] == "verifier" and s["id"] in t.finished and last_edit < t.finished[s["id"]][0] < r["idx"]
        ]
        if not ran and not verified:
            bad.append(r)
    return not bad, f"{len(bad)} review(s) started with no check run after the last edit" if bad else "checks ran after the last edit before every review"


def fix_rounds_capped(t, sc, rule):
    reviews = t.of_role("reviewer")
    if not reviews:
        return True, "no reviewer spawned (n/a)"
    first = reviews[0]["idx"]
    fixes = [s for s in t.main_spawns if s["role"] in ("implementor", "debugger") and s["idx"] > first]
    ok = len(fixes) <= 2 and len(reviews) <= 3
    return ok, f"{len(fixes)} fix spawns after first review, {len(reviews)} reviews"


def debugger_at_most_once(t, sc, rule):
    n = len(t.of_role("debugger"))
    return n <= 1, f"{n} debugger spawns"


def nested_verifier_awaited(t, sc, rule):
    """An implementor that spawns a verifier must wait for it before returning."""
    bad = []
    for child in t.spawns:
        parent = next((s for s in t.spawns if s["id"] == child["parent"]), None)
        if not parent or child["id"] not in t.finished or parent["id"] not in t.finished:
            continue
        if t.finished[child["id"]][0] > t.finished[parent["id"]][0]:
            bad.append(f"{parent['role']} returned before its {child['role']} finished")
    nested = sum(1 for s in t.spawns if s["parent"])
    return not bad, "; ".join(bad) if bad else f"{nested} nested spawns, all awaited"


def no_depth_refusals(t, sc, rule):
    refused = ((t.result.get("subagent_stats") or {}).get("refused") or {}).get("depth_limit", 0)
    return refused == 0, f"{refused} spawns refused at the depth limit"


def main_does_not_edit(t, sc, rule):
    if not t.of_role("implementor"):
        return True, "no implementor spawned: main built it directly (n/a)"
    edits = [args.get("file_path", "") for _, name, args, parent in t.tools if name in EDIT_TOOLS and not parent]
    return not edits, f"main conversation edited {edits[:5]}" if edits else "all edits made by subagents"


def report_lists_agents(t, sc, rule):
    roles = {s["role"] for s in t.main_spawns} - {"other"}
    final = t.final_text()
    named = sorted(r for r in roles if re.search(ROLE_WORDS[r], final, re.I))
    need = min(2, len(roles))
    return len(named) >= need, f"final report names {named or 'no roles'} of {sorted(roles)}"


def role_count(t, sc, rule):
    n = len(t.of_role(rule["role"]))
    ok = rule.get("min", 0) <= n <= rule.get("max", 99)
    return ok, f"{n} {rule['role']} spawns"


def role_before(t, sc, rule):
    a, b = t.of_role(rule["before"]), t.of_role(rule["after"])
    if not a or not b:
        return False, f"{rule['before']}: {len(a)}, {rule['after']}: {len(b)}"
    return a[0]["idx"] < b[0]["idx"], f"first {rule['before']} at event {a[0]['idx']}, first {rule['after']} at {b[0]['idx']}"


def max_agents(t, sc, rule):
    n = len(t.spawns)
    return n <= rule["max"], f"{n} spawns: {describe(t.spawns)}"


def role_model(t, sc, rule):
    spawns = t.of_role(rule["role"])
    hits = [s for s in spawns if s["family"] in rule["models"]]
    return bool(hits), f"{rule['role']} models: {[s['family'] for s in spawns] or 'not spawned'}"


def heavy_step_announced(t, sc, rule):
    opus = [s for s in t.main_spawns if s["family"] == "opus"]
    if not opus:
        return True, "no opus subagent (n/a)"
    before = " ".join(text for idx, text in t.main_texts if idx < opus[0]["idx"])
    return bool(re.search(r"opus", before, re.I)), "opus spawn announced" if "opus" in before.lower() else "opus spawn not announced"


def no_edits(t, sc, rule):
    edits = [(name, args.get("file_path", "")) for _, name, args, _ in t.tools if name in EDIT_TOOLS]
    return not edits, f"edits: {edits[:5]}" if edits else "no Edit/Write calls"


def final_regex(t, sc, rule):
    final = t.final_text()
    found = re.search(rule["pattern"], final, re.I if "i" in rule.get("flags", "") else 0)
    return bool(found), f"matched {found.group(0)!r}" if found else f"no match for /{rule['pattern']}/"


RULES = {f.__name__: f for f in [
    spawn_models_are_aliases, named_agents_used, roles_use_roster_models, handoffs_use_template, results_use_template,
    stages_announced_first, checks_before_review, fix_rounds_capped, debugger_at_most_once,
    nested_verifier_awaited, no_depth_refusals, main_does_not_edit, report_lists_agents, role_count, role_before,
    max_agents, role_model, heavy_step_announced, no_edits, final_regex,
]}

PIPELINE_RULES = [
    {"name": "every spawn pins a model alias", "rule": "spawn_models_are_aliases"},
    {"name": "spawns use the named agents when loaded", "rule": "named_agents_used"},
    {"name": "roles run on their roster models", "rule": "roles_use_roster_models"},
    {"name": "handoff prompts use the template", "rule": "handoffs_use_template"},
    {"name": "subagents return the result template", "rule": "results_use_template"},
    {"name": "stages announced before the first spawn", "rule": "stages_announced_first"},
    {"name": "checks pass before any review", "rule": "checks_before_review"},
    {"name": "fix loop capped at 2 rounds", "rule": "fix_rounds_capped"},
    {"name": "debugger spawned at most once", "rule": "debugger_at_most_once"},
    {"name": "nested verifier awaited by its implementor", "rule": "nested_verifier_awaited"},
    {"name": "no spawns refused at the depth limit", "rule": "no_depth_refusals"},
    {"name": "main conversation leaves edits to subagents", "rule": "main_does_not_edit"},
    {"name": "a reviewer checked the result", "rule": "role_count", "role": "reviewer", "min": 1},
    {"name": "final report lists the agents that ran", "rule": "report_lists_agents"},
]


def run_command(check, workspace, scenario_id):
    env = dict(os.environ, HIDDEN=str(HERE / "hidden" / scenario_id), PYTHONPATH=str(workspace), PYTHONDONTWRITEBYTECODE="1")
    proc = subprocess.run(check["cmd"], shell=True, cwd=workspace, env=env, capture_output=True, text=True, timeout=900)
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-3:]
    return proc.returncode == 0, " | ".join(tail) or f"exit {proc.returncode}"


def metrics(t):
    by_model = {}
    for model, usage in (t.result.get("modelUsage") or {}).items():
        fam = family(model)
        by_model[fam] = round(by_model.get(fam, 0) + usage.get("costUSD", 0), 4)
    total = t.result.get("total_cost_usd") or sum(by_model.values())
    main_tools = {}
    for _, name, _, parent in t.tools:
        if not parent:
            main_tools[name] = main_tools.get(name, 0) + 1
    return {
        "cost_usd": round(total, 4),
        "cost_by_model": by_model,
        "opus_share": round(by_model.get("opus", 0) / total, 3) if total else None,
        "spawns": [
            f"{s['role']}:{s['family']}/{s['effort'] or ('fm' if named_agent(s) else '-')}" + (" (nested)" if s["parent"] else "")
            for s in t.spawns
        ],
        "main_tool_calls": main_tools,
        "subagent_stats": t.result.get("subagent_stats"),
        "duration_s": round((t.result.get("duration_ms") or 0) / 1000, 1),
        "num_turns": t.result.get("num_turns"),
        "result_subtype": t.result.get("subtype"),
        "is_error": t.result.get("is_error"),
    }


def grade(run_dir, scenario, arm):
    run_dir = pathlib.Path(run_dir)
    t = Trace(load_trace(run_dir / "trace.jsonl"))
    workspace = pathlib.Path(json.loads((run_dir / "meta.json").read_text())["workspace"])
    checks = []
    loaded = any(re.fullmatch(r"((feature-flow(-lite)?):)?feature-flow(-lite)?", name) for name in (t.init or {}).get("skills") or [])
    if bool(arm["skill"]) != loaded:
        checks.append(("setup", "arm loaded the skill as configured", False, f"skill loaded={loaded}, expected {arm['skill']}"))
    scenario = dict(scenario, _pinned_model=(arm.get("agents") or {}).get("model"))
    if not t.result:
        checks.append(("setup", "run reported a result", False, "the trace has no result event, so cost and timing are unknown; re-run it"))
    stats = t.result.get("subagent_stats") or {}
    settled = stats.get("completed", 0) + stats.get("failed", 0) + sum((stats.get("killed") or {}).values())
    if stats.get("spawned", 0) > settled:
        checks.append(("setup", "run waited for its subagents", False,
                       f"{stats['spawned'] - settled} of {stats['spawned']} subagents still running when the run ended; re-run it"))
    rules = list(scenario.get("checks", []))
    if scenario.get("pipeline", True):
        rules = [dict(r, kind="process") for r in PIPELINE_RULES] + rules
    for check in rules:
        kind = check.get("kind", "outcome")
        if kind == "process" and not arm["skill"]:
            continue  # the baseline is only held to outcomes
        if "cmd" in check:
            if not workspace.exists():
                continue
            passed, evidence = run_command(check, workspace, scenario.get("hidden", scenario["id"]))
        else:
            passed, evidence = RULES[check["rule"]](t, scenario, check)
        checks.append((kind, check["name"], passed, evidence))
    expectations = [{"text": f"[{kind}] {name}", "passed": passed, "evidence": evidence} for kind, name, passed, evidence in checks]
    n_pass = sum(e["passed"] for e in expectations)

    def rate(kind):
        sub = [c for c in checks if c[0] == kind]
        return round(sum(c[2] for c in sub) / len(sub), 3) if sub else None

    grading = {
        "expectations": expectations,
        "summary": {
            "passed": n_pass,
            "failed": len(expectations) - n_pass,
            "total": len(expectations),
            "pass_rate": round(n_pass / len(expectations), 3) if expectations else None,
            "process_pass_rate": rate("process"),
            "outcome_pass_rate": rate("outcome"),
        },
        "metrics": metrics(t),
    }
    (run_dir / "grading.json").write_text(json.dumps(grading, indent=2))
    return grading


if __name__ == "__main__":
    run_dir, scenario_id = sys.argv[1], sys.argv[2]
    config = json.loads((HERE / "scenarios.json").read_text())
    scenario = next(s for s in config["scenarios"] if s["id"] == scenario_id)
    meta = json.loads((pathlib.Path(run_dir) / "meta.json").read_text())
    result = grade(run_dir, scenario, config["arms"][meta["arm"]])
    for e in result["expectations"]:
        print("PASS" if e["passed"] else "FAIL", e["text"], "-", e["evidence"])
    print(json.dumps(result["metrics"], indent=2))
