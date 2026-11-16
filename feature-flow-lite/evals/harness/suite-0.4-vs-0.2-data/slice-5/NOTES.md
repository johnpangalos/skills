# Slice 5: chi-etag, risky-inventory — lite-shipped-0.2 vs lite-shipped-0.4, 3 reps

Batch: `results/20261116-185158`.

- chi-etag / lite-shipped-0.2 reps 1 and 3 failed setup in the first pass. Two parallel `setup_repo.sh` runs raced on the cold `~/.cache/ff-evals/chi` clone ("destination path already exists", `shallow.lock`), see `run.log.txt`. Each was rerun once, after the cache was warm, with `run.py -s chi-etag -a lite-shipped-0.2 -n 2 -o results/20261116-185158-rerun` (`rerun.log.txt`, `rerun-summary.md`). Rerun rep-1 became rep-1 and rerun rep-2 became rep-3, so the `meta.json` in `chi-etag/lite-shipped-0.2/rep-3` still says `"rep": 2`, and so do `threads.json` and `probes.json` for that run. The batch was then re-graded with `run.py --regrade` (`regrade.txt`, `summary.md`).
- `hidden_cases.py` only parses Python unittest output, so its chi-etag rows read `(import)`. Per-case Go results come from `go test -race -v` on the hidden file in each workspace, in `hidden_cases_go.txt`.
- `threads.json` is the stdout of `threads.py`, which is JSON.
