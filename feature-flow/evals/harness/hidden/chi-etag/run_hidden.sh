#!/bin/bash
# run the hidden ETag tests from a package of their own (so they can't clash with the run's tests), then remove them
set -u
dir=middleware/etaghidden
mkdir -p "$dir" && cp "$HIDDEN/etag_hidden_test.go" "$dir/"
race=; command -v gcc >/dev/null && race=-race
go test $race -count=1 "./$dir" 2>&1 | tail -30
status=${PIPESTATUS[0]}
rm -rf "$dir"
exit "$status"
