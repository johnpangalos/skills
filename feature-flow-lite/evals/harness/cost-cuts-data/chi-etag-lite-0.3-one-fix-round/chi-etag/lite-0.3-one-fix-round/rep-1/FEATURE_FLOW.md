# Feature Flow: chi

## Kind

Existing codebase of a library: Go HTTP router (`github.com/go-chi/chi/v5`) with a `middleware` package. Go 1.24 minimum (CI tests the four latest Go versions).

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`); `go vet ./...`; `gofmt -l .` (must print nothing)
- Targeted: `go test -race ./middleware -run TestName`
- Run it: a throwaway `main.go` or `httptest` test that mounts the middleware on a `chi.NewRouter()`

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, using `httptest` and the `testRequest` helper in `middleware_test.go`), a row in README's "Core middlewares" table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link in the link list below it, same position in both. CHANGELOG.md is per-release only; no per-feature entry.
- A middleware that wraps the ResponseWriter: see `wrap_writer.go` for the optional interfaces (Flusher, Hijacker, Pusher, io.ReaderFrom, Unwrap) it must keep working.

## Standing criteria

- `go test -race ./...`, `go vet ./...` pass and `gofmt -l .` prints nothing.
- No new dependencies in go.mod; stdlib only, compatible with Go 1.24.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README row and link).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- A ResponseWriter wrapper: compare the same handler with and without it (status, headers, body, Flush, Hijack, trailers, headers mutated after WriteHeader, 1xx).
- A buffering ResponseWriter must mirror net/http: Flush commits the status, 1xx only before the final status, invalid codes panic inside the handler (so an inner Recoverer catches them), early-declared trailer values stay in the header block, non-canonical header keys (`h["ETag"]`).
