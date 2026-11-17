# Triggered checks

Each item has a trigger you can read from the request, the acceptance criteria or the diff, a
check, and where it came from. Before the reviewer runs, the main conversation reads the diff
and copies every item whose trigger matches, word for word, into the reviewer's handoff as
`TRIGGERED CHECKS:`. Usually 2 to 5 match. Don't add items that don't match: a check that
doesn't apply is noise.

Add an item only for a miss that recurred, that a diff can show, and that a probe can
reproduce. Remove an item when it stops finding anything.

## Shared state

- **Trigger:** the change reads and then writes state kept between calls: a module-level or
  class-level dict, list, set or counter, a cache, a store, a balance, a token table, a file.
- **Check:** run the operation from 8 or more threads at once, for many rounds, on the same
  key, and check the invariant after each round (used once, never over the cap, one record per
  key). If the race window is too narrow to hit, widen it in a scratch copy with a short sleep
  between the check and the write, and say you did. A race the widened copy reproduces is
  [blocking]. The fix is a lock (or equivalent) held across both the check and the write. The
  diff needs a concurrent test of its own; if it has none, that is [blocking] too.
- **From:** token redemption and partial refunds, where every hidden test and audit passed and
  the race shipped.

## Invariants, round trips and equivalence

- **Trigger:** the criteria state something that must always hold (a balance never negative,
  a total never over a cap), a round trip (parse then format, encode then decode), idempotency
  (doing it twice equals doing it once), or that new code must match old code.
- **Check:** a property test. Use the repo's property library if it has one (Hypothesis,
  fast-check, proptest); otherwise a seeded random loop of at least 1000 generated inputs,
  including the hostile ones, that asserts the property and prints the first failing input.
- **From:** edge cases that the implementor's own tests missed because the tests shared the
  code's assumptions.

## Wrappers and stand-ins

- **Trigger:** the new code wraps or replaces something: a response writer, stream, handler,
  middleware, file, parameter type, DOM node.
- **Check:** a differential test. Run the same inputs through the wrapped and the unwrapped
  version, across call orders (before and after the first write, flush, hijack, close, a
  second call), and diff every output: status, headers, body, errors, side effects. The
  handoff's `APPROVED DIFFERENCES:` lists what the request changes on purpose. A difference
  not on that list is [blocking]. So is an approved difference that doesn't actually happen:
  check each one directly, in every call order.
- **From:** a buffering response writer whose Flush still sent bytes early, which the request
  ruled out; probes that compared only pass-through behaviour couldn't see it.

## Nesting and composition

- **Trigger:** the code walks a tree or a container (DOM, shadow roots, portals, slots,
  routers, nested config), or the thing it builds can contain another of itself.
- **Check:** nest it. Put a target inside another target, including inside another target's
  shadow root; a dialog in a dialog; a router mounted in a router. Check the inner and the
  outer each still behave as they do alone, and that nothing inside a target gets the
  treatment meant for what's outside it.
- **From:** hide-everything-else logic that walked into a nested target's shadow root, and
  dialogs where one Escape closed both.

## Focus and keyboard

- **Trigger:** the change moves, traps or restores focus, or handles keys (modals, menus,
  tabs, comboboxes, roving tab index).
- **Check:** drive the real component with user events, not function calls. Open it from a
  button and close it: focus goes back to that button, even when a child uses autoFocus. With
  a trap open, Tab and Shift+Tab never reach hidden, inert, disabled or `tabIndex=-1` content,
  including the component's own hidden panels. Escape closes only the top layer. Elements
  added after it opened are handled.
- **From:** focus traps that leaked into hidden content, and focus returned to the wrong
  element.

## Active and selected items in a changing list

- **Trigger:** the component tracks an active, highlighted or selected item in a list that
  can change while it's shown (filtered, async, reordered, prepended).
- **Check:** change the list while it's open: prepend an item, filter, remove the active one.
  The active item must still be the same item, not the same index, and Enter must commit that
  item. Clearing the selection must work (null or empty), and say so in the change event.
- **From:** comboboxes that tracked the active option by index and committed the wrong one.

## HTTP responses

- **Trigger:** the change sets or computes response headers, status or body (caching,
  compression, ETags, content length, streaming).
- **Check:** probe HEAD, a conditional request that should return 304, an empty body, a
  response streamed across several writes, headers set after the first write, and an error
  status. Each gets the headers its method and status call for; a HEAD response never carries
  a validator computed from an empty body.
- **From:** ETags computed from the empty body of HEAD responses.

## New dependencies

- **Trigger:** the diff adds or changes a dependency in a manifest (package.json, go.mod,
  Cargo.toml, pyproject).
- **Check:** the lockfile changed with it, and the frozen install passes (`yarn install
  --immutable`, `pnpm install --frozen-lockfile`, `npm ci`, `go mod verify`, `cargo build
  --locked`).
- **From:** builds that added a dependency without updating yarn.lock.

## Money and numbers

- **Trigger:** the change parses, computes or shows amounts or other numbers users enter.
- **Check:** sub-unit amounts, NaN and infinity, a number given as a string or float instead
  of the expected type, negative and zero values, values past the type's range, equal amounts
  spelled differently, and what's shown for a negative zero (`-$0.00`).
- **From:** refunds, discount codes and receipts.

## Command output

- **Trigger:** the change adds a CLI flag, command or output.
- **Check:** output to a closed or full stream (`> /dev/full`, `| head -0`) exits non-zero
  with a message; every shell completion and help page the sibling flag appears in lists the
  new one; conflicting flags give an error.
- **From:** CLI flags that failed silently on write errors or were missing from completions.
