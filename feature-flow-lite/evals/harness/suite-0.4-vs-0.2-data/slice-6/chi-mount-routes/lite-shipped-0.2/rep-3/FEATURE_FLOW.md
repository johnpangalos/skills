# Feature Flow: chi

## Kind

Library: Go HTTP router (go-chi/chi v5), root package plus `middleware/`.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `./middleware`); `go vet ./...`; `gofmt -l .` must print nothing
- Targeted: `go test -race -run 'TestName' .`
- Run it: write a probe `_test.go` (or a scratch `main` using `github.com/go-chi/chi/v5` via a `replace`) and call `chi.Walk` / `Mux.Routes()` / `httptest`

## Conventions

- Router/tree fix: change in `tree.go` / `mux.go`; regression test as a `TestXxx` func in `tree_test.go` (tree/Walk) or `mux_test.go` (mux behavior), stdlib `testing` only, no testify.
- CHANGELOG.md is only updated at release time with a compare link; no per-change entry.

## Standing criteria

- The existing test suite still passes.
- No new dependencies; public API unchanged unless the request asks for it.

## Reviewer checklist

- The change follows the patterns around it (naming, test style in `tree_test.go`/`mux_test.go`).
- `Walk`/`Routes()` output for routers outside the bug's scope is unchanged (compare before/after on the repo's existing routers and `_examples`).
- Routing behavior (`ServeHTTP`) is unchanged.
