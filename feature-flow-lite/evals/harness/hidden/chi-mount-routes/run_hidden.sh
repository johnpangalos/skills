#!/bin/bash
# run the hidden regression tests inside package chi (renamed so they can't clash with the run's tests), then remove them
set -u
cp "$HIDDEN/routes_hidden_test.go" zz_routes_hidden_test.go
go test -count=1 -run 'TestHidden' . 2>&1 | tail -30
status=${PIPESTATUS[0]}
rm -f zz_routes_hidden_test.go
exit "$status"
