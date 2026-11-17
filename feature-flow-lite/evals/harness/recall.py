#!/usr/bin/env python3
"""Stage recall: where do known (keyed) bugs get lost in the feature-flow-lite pipeline?

For every build of the hard tasks in the 0.4-vs-0.2 suite and every keyed bug in probes/keys.json:

  present  - the deterministic probe reproduces the key (probes/keys-round2.json); whether either
             round-2 judge's confirmed_defects describes it is kept as `judge_present` for comparison
  found    - some reviewer's FINDINGS describes the key
  sent     - an implementor handoff spawned after that review carries the finding

and the build lands in one bucket:

  never_found      present, not found
  found_dropped    found, never sent to an implementor
  sent_not_fixed   sent, still present
  found_fixed      sent, absent
  absent_unflagged absent, not found (also: found-and-dropped but absent, see `note`)

Both yes/no matchers are one `claude -p --model sonnet` call each, cached in recall-cache/.

    python3 recall.py            # all builds, writes recall.json and RECALL.md
    python3 recall.py --jobs 8
"""
import argparse
import concurrent.futures as cf
import glob
import gzip
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from grade import Trace  # noqa: E402

DATA = HERE / "suite-0.4-vs-0.2-data"
CACHE = HERE / "recall-cache"
TASKS = ["chi-etag", "rac-shadow-hide", "ui-lib", "website-bookshop", "risky-auth", "risky-refunds"]
ARMS = ["lite-shipped-0.2", "lite-tests-first", "lite-reviewer-plus"]
BUCKETS = ["never_found", "found_dropped", "sent_not_fixed", "found_fixed", "absent_unflagged"]


def load_events(path):
    opener = gzip.open if str(path).endswith(".gz") else open
    events = []
    with opener(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return events


def load_trace(build_dir):
    paths = glob.glob(str(build_dir / "trace.jsonl*"))
    if not paths:
        raise FileNotFoundError(f"no trace in {build_dir} (fetch it from the worker branch in judge/plan2.tsv)")
    return Trace(load_events(paths[0]))


def findings_section(text):
    """The FINDINGS block of a reviewer's return, or the whole text if it has none."""
    m = re.search(r"^\s*\**FINDINGS\**:?\s*$(.*?)(?=^\s*\**(CHECKS|OPEN QUESTIONS|FILES TOUCHED|NOTES)\**:?|\Z)", text, re.M | re.S)
    if m and m.group(1).strip():
        return m.group(1).strip()
    return text.strip()


def pipeline(trace):
    """Reviews and the implementor handoffs that follow each, in spawn order."""
    reviews, handoffs = [], []
    for s in trace.main_spawns:
        if s["role"] == "reviewer":
            reviews.append({"n": len(reviews) + 1, "findings": findings_section(trace.returned_text(s))})
        elif s["role"] in ("implementor", "debugger") and reviews:
            handoffs.append({"after_review": len(reviews), "prompt": s["prompt"]})
    return reviews, handoffs


# --- judges -------------------------------------------------------------------------------

def judge_defects():
    """(task, arm, rep) -> list of confirmed_defects strings from both round-2 judges."""
    out = defaultdict(list)
    for path in sorted((DATA / "judge").glob("round2-g*.json")):
        for task_entry in json.load(open(path)):
            task = task_entry["id"]
            remap = json.load(open(DATA / "judge" / f"remap2-{task}.json"))
            for j, judge in enumerate(task_entry["judges"]):
                for r in judge["ranking"]:
                    m = remap[r["letter"]]
                    out[(task, m["arm"], int(m["rep"]))].extend(f"judge {j + 1}: {d}" for d in r.get("confirmed_defects") or [])
    return out


def probe_failing():
    """(task, arm, rep) -> set of keyed bug ids the deterministic probes reproduce (probes/keys-round2.json)."""
    out = {}
    for task, letters in json.load(open(HERE / "probes" / "keys-round2.json")).items():
        if task.startswith("_"):
            continue
        for letter, v in letters.items():
            out[(task, v["arm"], int(v["rep"]))] = set(v.get("failing") or [])
    return out


def judge_rank():
    """(task, arm, rep) -> (mean score, letter, n confirmed defects) for picking clean builds."""
    out = {}
    for path in sorted((DATA / "judge").glob("round2-g*.json")):
        for task_entry in json.load(open(path)):
            task = task_entry["id"]
            remap = json.load(open(DATA / "judge" / f"remap2-{task}.json"))
            acc = defaultdict(lambda: {"scores": [], "defects": 0})
            for judge in task_entry["judges"]:
                for r in judge["ranking"]:
                    acc[r["letter"]]["scores"].append(r["score"])
                    acc[r["letter"]]["defects"] += len(r.get("confirmed_defects") or [])
            for letter, v in acc.items():
                m = remap[letter]
                out[(task, m["arm"], int(m["rep"]))] = (sum(v["scores"]) / len(v["scores"]), letter, v["defects"])
    return out


# --- the sonnet matcher ------------------------------------------------------------------

def ask_sonnet(prompt, tag):
    """One cached `claude -p --model sonnet` call; returns the parsed JSON answer."""
    CACHE.mkdir(exist_ok=True)
    key = hashlib.sha256(prompt.encode()).hexdigest()[:24]
    path = CACHE / f"{tag}-{key}.json"
    if path.exists():
        return json.load(open(path))
    for attempt in range(3):
        proc = subprocess.run(
            ["claude", "-p", "--model", "sonnet", "--tools", "", "--output-format", "json",
             "--no-session-persistence", "--setting-sources", ""],
            input=prompt, capture_output=True, text=True, timeout=600, cwd="/tmp",
        )
        try:
            outer = json.loads(proc.stdout)
            text = outer.get("result", "")
            m = re.search(r"\{.*\}", text, re.S)
            answer = json.loads(m.group(0))
            answer["_cost"] = outer.get("total_cost_usd")
            answer["_prompt"] = prompt
            json.dump(answer, open(path, "w"), indent=1)
            return answer
        except Exception as e:  # noqa: BLE001
            err = f"{e}: {proc.stdout[-400:]} {proc.stderr[-400:]}"
    raise RuntimeError(f"matcher failed: {err}")


MATCH_RULES = """Rules:
- Answer "yes" only if the text describes THIS specific bug: the same faulty behaviour in the same situation. A finding about a nearby but different behaviour (another header, another edge case, a different race) is "no".
- A finding that says the behaviour was checked and PASSED, or that the code handles it correctly, is "no".
- Wording does not matter; the behaviour does."""


def match_findings(key_text, reviews, handoffs):
    """Did any review describe the key, and did a later implementor handoff carry it?"""
    parts = []
    for r in reviews:
        parts.append(f"=== REVIEW {r['n']} FINDINGS ===\n{r['findings']}")
    for i, h in enumerate(handoffs, 1):
        parts.append(f"=== IMPLEMENTOR HANDOFF {i} (sent after review {h['after_review']}) ===\n{h['prompt']}")
    prompt = f"""You are matching code-review findings against a known bug. Reply with ONLY a JSON object.

KNOWN BUG: {key_text}

{MATCH_RULES}
- For handoffs: count only text that tells the implementor to fix this bug (a reported finding, a fix instruction). Restated acceptance criteria that merely describe the desired behaviour do NOT count as carrying the finding unless the handoff ties them to a reported failure.

{chr(10).join(parts) if parts else '(no reviews)'}

Reply exactly:
{{"found": "yes"|"no", "review": <review number or null>, "finding_quote": "<verbatim quote of the finding, or empty>",
  "sent": "yes"|"no", "handoff": <handoff number or null>, "handoff_quote": "<verbatim quote from the handoff, or empty>"}}
"sent" can be "yes" only if "found" is "yes" and the handoff came after that review."""
    return ask_sonnet(prompt, "find")


def match_judges(key_text, defects):
    prompt = f"""You are deciding whether a known bug is present in a build, from the defects two judges confirmed by probing it. Reply with ONLY a JSON object.

KNOWN BUG: {key_text}

{MATCH_RULES}

CONFIRMED DEFECTS:
{chr(10).join('- ' + d for d in defects) if defects else '(none)'}

Reply exactly: {{"present": "yes"|"no", "quote": "<verbatim quote of the matching defect, or empty>"}}"""
    if not defects:
        return {"present": "no", "quote": "", "_cost": 0}
    return ask_sonnet(prompt, "judge")


# --- main ---------------------------------------------------------------------------------

def builds():
    for task in TASKS:
        for arm in ARMS:
            for d in sorted(DATA.glob(f"*/{task}/{arm}/rep-*")):
                yield task, arm, int(d.name.split("-")[1]), d


def classify(present, found, sent):
    if sent and present:
        return "sent_not_fixed"
    if sent:
        return "found_fixed"
    if found and present:
        return "found_dropped"
    if found:
        return "found_dropped"  # absent anyway; flagged in `note`
    return "never_found" if present else "absent_unflagged"


def run_one(task, arm, rep, d, key_id, key_text, defects, failing):
    trace = load_trace(d)
    reviews, handoffs = pipeline(trace)
    f = match_findings(key_text, reviews, handoffs)
    j = match_judges(key_text, defects)
    if failing is None:
        raise KeyError(f"{task} {arm} rep {rep} is not in probes/keys-round2.json")
    present = key_id in failing  # the deterministic probe is the signal; the judge match is kept for comparison
    found = f["found"] == "yes"
    sent = found and f["sent"] == "yes"
    bucket = classify(present, found, sent)
    note = "dropped, but absent from the final build anyway" if bucket == "found_dropped" and not present else ""
    return {
        "task": task, "arm": arm, "rep": rep, "dir": str(d.relative_to(HERE)), "key": key_id,
        "present": present, "judge_present": j["present"] == "yes", "judge_quote": j.get("quote", ""), "found": found, "review": f.get("review"),
        "finding_quote": f.get("finding_quote", ""), "sent": sent, "handoff_quote": f.get("handoff_quote", ""),
        "n_reviews": len(reviews), "n_fix_handoffs": len(handoffs), "bucket": bucket, "note": note,
        "matcher_cost": (f.get("_cost") or 0) + (j.get("_cost") or 0),
    }


def render(rows, keys):
    out = ["# Stage recall: where keyed bugs get lost", "",
           "Generated by `recall.py`. One row per (build, keyed bug) for the arms lite-shipped-0.2, lite-tests-first and lite-reviewer-plus on the hard tasks.",
           "`present` comes from the deterministic answer-key probes (`probes/keys-round2.json`); `found` and `sent` from a sonnet yes/no matcher over each review's FINDINGS and the later implementor handoffs.",
           "", "Buckets: **never** = in final build, no reviewer finding; **dropped** = found, not handed to an implementor; **not fixed** = handed over, still in final build; **fixed** = handed over, gone; **absent** = not in final build and never flagged.",
           "", "website-bookshop has no keys in probes/keys.json, so it contributes no rows.", ""]
    labels = {"never_found": "never", "found_dropped": "dropped", "sent_not_fixed": "not fixed", "found_fixed": "fixed", "absent_unflagged": "absent"}

    # per arm
    lines = ["## Per arm (all keys pooled)", "", "| arm | rows | " + " | ".join(labels[b] for b in BUCKETS) + " | in final build | found (any) | recall on bugs that shipped |", "|---|---|" + "---|" * (len(BUCKETS) + 3)]
    for arm in ARMS:
        rs = [r for r in rows if r["arm"] == arm]
        c = Counter(r["bucket"] for r in rs)
        present = [r for r in rs if r["present"]]
        found_any = sum(r["found"] for r in rs)
        lines.append(f"| {arm} | {len(rs)} | " + " | ".join(str(c[b]) for b in BUCKETS)
                     + f" | {len(present)} | {found_any} | {sum(r['found'] for r in present)}/{len(present)} |")
    out += lines + [""]

    # per arm per key
    out += ["## Per arm, per key", "", "Cells: never / dropped / not fixed / fixed / absent, over the builds of that arm.", "",
            "| task | key | " + " | ".join(ARMS) + " |", "|---|---|" + "---|" * len(ARMS)]
    for task in TASKS:
        for key_id in (keys.get(task) or {}):
            cells = []
            for arm in ARMS:
                c = Counter(r["bucket"] for r in rows if r["task"] == task and r["key"] == key_id and r["arm"] == arm)
                cells.append(" / ".join(str(c[b]) for b in BUCKETS))
            out.append(f"| {task} | {key_id} | " + " | ".join(cells) + " |")
    out += ["", "## Per stage (all arms)", ""]
    present = [r for r in rows if r["present"]]
    found = [r for r in rows if r["found"]]
    sent = [r for r in rows if r["sent"]]
    out += [f"- Keyed bugs in final builds: {len(present)} of {len(rows)} (build, key) pairs.",
            f"- Lost at review (never found): {sum(r['bucket'] == 'never_found' for r in rows)}.",
            f"- Lost at the orchestrator (found, not sent, still in final build): {sum(r['bucket'] == 'found_dropped' and r['present'] for r in rows)}; found-and-dropped but gone anyway: {sum(r['bucket'] == 'found_dropped' and not r['present'] for r in rows)}.",
            f"- Lost at the fix (sent, still in final build): {sum(r['bucket'] == 'sent_not_fixed' for r in rows)} of {len(sent)} sent.",
            f"- Probe vs judge presence: {sum(r['present'] == r['judge_present'] for r in rows)} of {len(rows)} rows agree (the judge-based signal was the stand-in before the probes landed).",
            f"- Found at all: {len(found)}; found and fixed: {sum(r['bucket'] == 'found_fixed' for r in rows)}.",
            "", f"Matcher cost: ${sum(r['matcher_cost'] for r in rows):.2f} (cached calls count once).", "", NOTES]
    return "\n".join(out) + "\n"


NOTES = """## Matcher spot-check (by hand, 10 rows)

| row | matcher said | my read | agree |
|---|---|---|---|
| chi-etag flush-bypass, tests-first rep 3 | present (judges: "Flush is a buffered no-op") | the opposite of the key: Flush that buffers is what the key asks for | no |
| rac-shadow-hide shadow-host-target, reviewer-plus rep 4 | present (judges: "siblings of an inner target in a shadow root inside an outer target get hidden") | that is nested-target-shadow; the outer target contains the host, it isn't one | no |
| ui-lib trap-hidden-content, reviewer-plus rep 1 | found, sent, still present | review 1 has `<input type="hidden">` [blocking] and display:none [minor]; only the first was sent; judges still saw display:none | yes |
| ui-lib focus-return-autofocus, shipped-0.2 rep 3 | never found | no finding in either review mentions autoFocus or focus return | yes |
| ui-lib nested-dialog-escape, tests-first rep 1 | found, sent, fixed | "nested dialogs mounted open together leave focus in the outer, so Escape and Tab act on the outer" | yes |
| ui-lib combobox-index, tests-first rep 1 | found, sent, not fixed | "Enter throws after options shrink: options[activeIndex] with a stale index"; the fix guarded the crash, not index tracking | yes |
| risky-auth token-race, shipped-0.2 rep 2 | found, dropped | "[minor] race not reproduced: 0 double successes; the check-then-add is not atomic" | yes |
| risky-refunds refund-race, reviewer-plus rep 2 | found, dropped | "[blocking, widened copy] shared-state race" with numbers, and no fix handoff after it | yes |
| chi-etag head-empty-etag, shipped-0.2 rep 2 | present | judge: "a HEAD handler that writes no body gets the empty-body hash" | yes |
| chi-etag head-empty-etag, shipped-0.2 rep 1 | absent | judges: "a bodiless HEAD gets no ETag", the safe behaviour | yes |

8 of 10. Both misses are on the judge-presence side, not the findings side: flush-bypass's key contradicts what the round-2 judges penalised (they marked buffered Flush as the defect, so no judge ever confirms a Flush that bypasses the buffer), and rac's nested-target-shadow and shadow-host-target keys overlap, so a nested-target defect also counts for shadow-host-target. Both are now moot: `present` comes from the deterministic probes (keys-round2.json), which flag flush-bypass on 15 of 23 chi-etag round-2 builds (the hidden TestFlushDoesNotBypassTheBuffer fails on the same ones; the judges were wrong, see probes/VALIDATION.md) and separate the two rac keys. The `judge_present` column in recall.json keeps the old judge-based signal for comparison.
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=8)
    args = ap.parse_args()
    keys = {k: v for k, v in json.load(open(HERE / "probes" / "keys.json")).items() if not k.startswith("_")}
    defects = judge_defects()
    probes = probe_failing()
    jobs = []
    for task, arm, rep, d in builds():
        for key_id, key_text in (keys.get(task) or {}).items():
            jobs.append((task, arm, rep, d, key_id, key_text, defects.get((task, arm, rep), []), probes.get((task, arm, rep))))
    rows = []
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        futs = [ex.submit(run_one, *j) for j in jobs]
        for fut in cf.as_completed(futs):
            rows.append(fut.result())
            print(f"{len(rows)}/{len(jobs)}", file=sys.stderr, end="\r")
    rows.sort(key=lambda r: (TASKS.index(r["task"]), r["key"], ARMS.index(r["arm"]), r["rep"]))
    json.dump(rows, open(HERE / "recall.json", "w"), indent=1)
    open(HERE / "RECALL.md", "w").write(render(rows, keys))
    print(f"\n{len(rows)} rows -> recall.json, RECALL.md")


if __name__ == "__main__":
    main()
