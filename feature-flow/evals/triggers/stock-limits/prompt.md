---
tags: [trigger, should-trigger]
runs: 3
model: opus
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

we need stock limits. catalog.py should track stock per SKU, Cart.add should raise OutOfStock when you ask for more than is left, and the receipt should flag backordered items. touches a few files, add tests pls
