# Feature Flow project file

## Kind
Go library (chi HTTP router) with a `middleware` package. Go 1.24 (CI: 1.24.x-1.27.x, ubuntu+windows).

## Checks
- `go test -race ./...`
- `go vet ./...`
- `test -z "$(gofmt -l .)"`

## Conventions
- New middleware: `middleware/<name>.go` with doc comment, tests in `middleware/<name>_test.go` (package middleware, httptest).
- README: a row in the "chi/middleware Handler" table plus a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line.
- CHANGELOG has no Unreleased section; recent middleware additions were not logged there.
- Response-writer wrappers: see `middleware/wrap_writer.go` (Flusher, Hijacker, ReaderFrom, Pusher, Unwrap).

## Standing criteria
- No new dependencies (stdlib only).

## Reviewer checklist
- Tests for every new behavior; gofmt/vet clean; no unrelated edits.
- Wrapped writers behave like the unwrapped one for inputs the middleware doesn't intend to change.
