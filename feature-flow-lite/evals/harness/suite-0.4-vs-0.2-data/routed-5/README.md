# routed-5 (worker 5: risky-auth, risky-refunds)

- `20261117-061642`: `-a lite-routed -n 5 -j 2`, blind dir `ff-judge-r5-1`. This batch had already finished when the parent session cancelled lite-routed, so its data is kept here.
- `20261117-063713`: top-up `-a lite-shipped-0.2,lite-shipped-0.4 -n 2 -j 2`, blind dir `ff-judge-r5-2`. Its reps 1 and 2 are stored as rep-4 and rep-5 (`"topup": true`, `"source_rep"` in meta.json). The rep numbers and run paths in its JSON files are renumbered to match. The free-text "rep N" lines in its run.txt and summary.md keep the original numbers.

No run failed setup, timed out or hit its budget cap. These scenarios have no probe dirs, so there are no probe outputs.
