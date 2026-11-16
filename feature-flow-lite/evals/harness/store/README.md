# Eval results store

- **D1** database `ff-evals` (id `3fec0dff-0bda-4066-8551-88e6a9dbf267`): one row per build in `runs`, plus `suites` and `judge_scores`. Schema in `schema.sql`.
- **R2** bucket `ff-evals`: raw files per build under `runs.r2_prefix` (`evals/<suite>/<scenario>/<arm>/rep-N/`): `trace.jsonl.gz`, `diff.patch`, `usage.jsonl`, plus each suite's blind-judging tarballs under `evals/<suite>/judge/`.

Load a suite's rows with `python3 to_sql.py <suite> <data dir> ... > rows.sql` and run the SQL against D1 (the Cloudflare connector's D1 query tool, or `wrangler d1 execute ff-evals --remote --file rows.sql`). Rows are upserts, so reloading is safe.

Git keeps the harness, summaries and per-build `grading.json`, `audit.json`, `meta.json` and `diff.patch`. Traces and tarballs go to R2, not git (see `../.gitignore`).
