# Feature Flow: chi

## Kind

Existing codebase of a library: Go HTTP router (`github.com/go-chi/chi`), stdlib only.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: router package and ./middleware with -race), `go vet ./...`, `test -z "$(gofmt -l .)"`
- Targeted: `go test -race -run 'TestName' .`
- Run it: library; probe with a throwaway `_test.go` file in the package or `httptest`.

## Conventions

- Router/tree bug fix: change in `tree.go` or `mux.go`, regression test next to similar tests in `tree_test.go` / `mux_test.go` (plain `testing`, no assertion libraries, `t.Fatalf`/`t.Errorf`). No new dependencies.
- CHANGELOG.md is updated by maintainers at release time; fixes don't add entries.

## Standing criteria

- The existing test suite still passes; no new dependencies; exported API unchanged unless the request asks.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Routing behavior (what ServeHTTP dispatches) is unchanged unless the request is about routing.
