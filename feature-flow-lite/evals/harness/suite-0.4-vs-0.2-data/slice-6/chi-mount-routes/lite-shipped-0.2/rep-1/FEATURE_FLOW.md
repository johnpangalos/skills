# Feature Flow project file

## Kind
Go library (HTTP router, github.com/go-chi/chi). Zero external dependencies.

## Checks
- `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`)
- `go vet ./...`
- `gofmt -l .` must print nothing
- CI matrix: Go 1.23.x–1.26.x on ubuntu and windows

## Run it
Library only: write a `_test.go` probe in the root package and run `go test -run <Name> .`

## Conventions
- Router/tree tests go in `tree_test.go` / `mux_test.go`, package `chi`. Table-driven tests use `t.Run` (see `TestWalkInlineMiddlewaresAcrossSubrouter` in tree_test.go).
- CHANGELOG.md does not take per-fix entries.
- No new dependencies.

## Standing criteria
- Public API stays the same unless the request says otherwise.
- Routing behavior (what a request is served by) stays the same for bug fixes in reporting code.

## Reviewer checklist
- Do `Walk` and `Mux.Routes()` still agree with what requests are actually routed to?
- Does the change hold for both `Route()` and `Mount()`, and for registrations made before and after the mount?
- gofmt, vet, and race tests are clean.
