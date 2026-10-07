---
tags: [trigger, should-trigger]
runs: 3
model: opus
max_turns: 4
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Customers say order totals are a cent off on big orders compared with what our accountant gets. I think it's per-line vs per-order tax rounding. Track it down, fix it, and add a regression test.
