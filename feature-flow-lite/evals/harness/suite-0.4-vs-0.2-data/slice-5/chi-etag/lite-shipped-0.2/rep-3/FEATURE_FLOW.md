# Feature Flow: chi

## Kind

Library: Go HTTP router (`github.com/go-chi/chi/v5`) with a `middleware` subpackage; stdlib only, no third-party deps.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`), `go vet ./...`, `gofmt -l .` (must print nothing)
- Targeted: `go test -race -run <TestName> ./middleware`
- Run it: write an `httptest` probe in a `_test.go` file (or `go run` a scratch main importing `github.com/go-chi/chi/v5/middleware` via a local `replace`)

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, `httptest`), a row in README.md's "Core middlewares" table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line. CHANGELOG.md is per release only; no entry per change.
- A middleware that wraps `http.ResponseWriter` forwards `Flush`, `Hijack`, `Push` and provides `Unwrap()` the way `middleware/compress.go` does, with errors worded `chi/middleware: http.Hijacker is unavailable on the writer`.

## Standing criteria

- The existing test suite still passes; `go vet ./...` clean; `gofmt -l .` prints nothing.
- No new module dependencies; code builds with the `go` version in go.mod (1.24).
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table row and link, tests next to the code).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding (for writer wrappers: Flush, Hijack, Push, Unwrap / http.ResponseController).
- Run the tests with `-race`.
- Header-list parsers (If-None-Match, Accept-*): probe a malformed member (e.g. an unterminated quote) followed by a valid one; the valid one must still be seen.
