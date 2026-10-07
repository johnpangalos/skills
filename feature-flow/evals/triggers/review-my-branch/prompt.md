---
tags: [trigger, should-not-trigger]
runs: 3
model: opus
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

can you look over the changes on my branch for bugs before I open the PR? mostly worried about the rounding in shop/money.py
