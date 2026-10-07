---
tags: [trigger, should-trigger]
runs: 3
model: opus
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Run this through the cheap sonnet/haiku subagent pipeline instead of doing it all yourself: add a loyalty-points balance to the cart (1 point per whole dollar of subtotal after discounts), shown on the receipt.
