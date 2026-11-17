# routed-3 (worker 3, scenario ui-lib)

- `r3-topup-ui-lib`: `-a lite-shipped-0.2,lite-shipped-0.4 -n 2`, a top-up of earlier runs that have reps 1–3. Its rep-1/rep-2 are stored as rep-4/rep-5 (`"rep"` and `"topup": true` in meta.json; blind-mapping.json reps adjusted to match; `run_dir` there still names the original rep dirs).
- No probes: ui-lib has no probe dir. `hidden_cases.py` doesn't parse vitest output, so it reports `(import)` for every build. Use grading.json's outcome check instead.
- `ff-judge-r3-1.tar.gz` is the blind dir for this batch.
