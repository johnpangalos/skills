# Feature Flow: <project name>

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

<one line: website | HTTP server | CLI | library | existing codebase of <kind>; language and
framework>

## Checks

- Full: <every command CI runs, in order: tests, lint, format, typecheck; one per line>
- Targeted: <how to run one test file or package, e.g. `pytest tests/test_x.py`>
- Run it: <how to start or render the thing for a probe: server start, page render, CLI entry>

## Conventions

<What a new feature of each kind touches here, found from how the last few were added
(`git log --stat`): changelog entry and its format, docs pages, man page, shell completions,
README tables, registries, where its tests live and how they're named. One line per kind of
change, e.g. "New flag: src/cli.rs, doc/man.md, contrib/completions/*, CHANGELOG.md under
Unreleased, tests in tests/cli.rs".>

## Standing criteria

<Requirements every change here must meet whether or not the request says so. They go into
every ACCEPTANCE CRITERIA list. Start from the kind's defaults below and drop what doesn't
apply.>

## Reviewer checklist

<The items the reviewer reproduces on every run here. Start from the kind's block below, drop
what doesn't apply, and add what this project has taught you (a bug a reviewer missed, a check
a maintainer asked for).>

## Risky paths

<Paths where the reviewer runs on Opus: auth, payments, migrations, concurrency. Or "none".>

<!-- Defaults by kind. Copy the block for this project's kind into the two sections above,
then delete this comment.

Website
  Standing: every feature works with JavaScript off; 360px wide without sideways scrolling;
  filter, sort or search state lives in the URL.
  Checklist: every feature with JavaScript off; keyboard navigation and visible focus; 360px
  width without sideways scrolling; form labels and errors; nothing decorative that looks
  interactive. Filter, sort or search state lives in the URL so a result can be bookmarked and
  shared, with and without JavaScript. A form submits somewhere real or says plainly that it's
  a demo; it never claims a message was sent when nothing was. Content is real enough to judge
  the design: no lorem ipsum, no one-line placeholder sections, lists long enough to need their
  filter. Tests that prove these load the page in a headless browser; a test that only reads
  the source doesn't count.

HTTP server
  Standing: JSON errors with the right status for unknown routes and wrong methods.
  Checklist: graceful shutdown and server timeouts; request body limits with the right status
  (413); JSON errors for unknown routes and wrong methods (404/405 with Allow); content types;
  concurrent writes.

CLI, or anything that stores data
  Standing: dates in the user's local time zone; every error exits non-zero with a message on
  stderr.
  Checklist: dates in the user's local time zone; overflow on large inputs; atomic writes;
  concurrent invocations (file locking); a missing or corrupt data file; exit codes and stderr
  for every error.

Library, or an existing codebase
  Standing: the existing test suite still passes; a new public feature follows the
  Conventions above.
  Checklist: the change follows the patterns around it (naming, registration, docs,
  changelog); anything the sibling named in FILES does that the new code should and doesn't is
  a finding.
-->
