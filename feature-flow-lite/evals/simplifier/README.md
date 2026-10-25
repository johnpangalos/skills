# Simplifier evals

Runs the `simplifier` agent on its own against planted diffs, with the handoff the
orchestrator would send. It checks that the agent pulls out building blocks without
merging look-alike code. See `grade.py` for what each case checks; every case also
requires the tests to pass, `behavior.py` output to stay the same, and no edits outside
the diff's files.

```
python3 run.py                                  # every case, old (main) + new prompt, 3 reps
python3 run.py -c flag-helper -a new -n 1
python3 run.py -a variant --variant path/to/simplifier.md
```

| Case | The diff | Right call |
|---|---|---|
| `two-pages` | invoice and receipt pages, mostly alike | keep two pages; sharing money/totals helpers is fine |
| `twin-pages` | two whole pages that differ only in wording | keep two pages |
| `two-handlers` | `create_user` and `create_product`, same structure | keep two handlers; extract the required-fields check |
| `flag-helper` | `send_notification(is_welcome=, is_password_reset=)` | inline it into its two callers |
| `date-formatter` | the same ordinal-date code copied three times | extract one formatter |
| `dead-code` | unused imports and variables, a pass-through wrapper, unreachable code | remove them |

## Results (Haiku, 3 reps per arm, 2026-10-25)

| Case | old (DRY prompt) | building blocks | building blocks + "small blocks count" |
|---|---|---|---|
| two-pages | 3/3 | 3/3 | 3/3, plus `_money` 3/3 |
| twin-pages | 3/3 | 3/3 | 3/3 |
| two-handlers | 3/3 | 3/3, but `_require_fields` 0/3 | 3/3, `_require_fields` 3/3 |
| flag-helper | **0/3** | 3/3 | 3/3 |
| date-formatter | 3/3 | 3/3 | 3/3 |
| dead-code | 3/3 | 3/3 | 3/3 |

- With the DRY prompt, Haiku never merged whole pages or handlers; it pulled out fragments
  instead. So the merge cases don't separate the prompts on this model.
- The real gap was the flag helper: the DRY prompt kept `send_notification`'s flags every
  time, and the building-blocks prompt inlined it every time.
- The first building-blocks wording over-corrected: it left the duplicated required-fields
  check alone, calling it "not a shared building block yet". One sentence saying building
  blocks are often a few lines fixed that, and the agent now ships with that sentence.

With Bash (reads the diff with git and runs the checks itself, no pasted diff): 18/18 across
the six cases, `_require_fields` 3/3. In 1 of 18 runs it rewrote a file with a shell heredoc
instead of Edit; the result was correct and stayed inside the diff.
