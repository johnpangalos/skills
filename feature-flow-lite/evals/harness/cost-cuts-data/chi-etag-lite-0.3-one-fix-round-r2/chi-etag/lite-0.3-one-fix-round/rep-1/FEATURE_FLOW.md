# Feature Flow: chi

## Kind

Existing codebase of a library: Go HTTP router (go-chi/chi v5), stdlib only, Go 1.24.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`); `go vet ./...`; `gofmt -l .` (must print nothing)
- Targeted: `go test -race -run <TestName> ./middleware`
- Run it: write a throwaway `_test.go` or `go run` program in the scratchpad using `httptest`

## Conventions

- New middleware: `middleware/<name>.go` with godoc on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, `httptest` + helpers in `middleware/middleware_test.go`), a row in README.md's "Core middlewares" table plus its reference link `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` in the link block below it. CHANGELOG.md is per-release only; don't add entries.
- No new dependencies in go.mod.

## Standing criteria

- The existing test suite still passes; `go vet ./...` clean; `gofmt -l .` prints nothing.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, godoc, README table + link, tests next to the code).
- A middleware that wraps the ResponseWriter handles the optional interfaces the way `middleware/wrap_writer.go` / `compress.go` do (Flush, Hijack, Push, ReadFrom, `Unwrap` for `http.ResponseController`), or deliberately doesn't and says why.
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
