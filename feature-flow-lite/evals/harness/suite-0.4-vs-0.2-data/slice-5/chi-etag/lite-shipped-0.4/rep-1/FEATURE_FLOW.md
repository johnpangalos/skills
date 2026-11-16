# Feature Flow project file

Kind: Go library (HTTP router + middleware package), module github.com/go-chi/chi/v5, go 1.24.

## Checks
- `go test -race ./...` (CI runs `make test`: go test -race -v . and ./middleware)
- `go vet ./...`
- `test -z "$(gofmt -l .)"`

## Conventions
- New middleware: `middleware/<name>.go` with doc comment on the exported func, tests in `middleware/<name>_test.go` (package middleware).
- README "chi/middleware Handler" table: one row `| [Name] | description |` plus link `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` in the link list below.
- Response wrappers: use/forward optional interfaces as `wrap_writer.go` does (http.Flusher, http.Hijacker, io.ReaderFrom, http.Pusher; Unwrap for http.ResponseController).
- No new dependencies.

## Standing criteria
- Exported identifiers documented; behavior described in doc comment.

## Reviewer checklist
- Response wrappers: diff with/without the wrapper for trailers, 1xx headers, ResponseController deadlines, Pusher, HEAD via ServeContent.
- Tests cover every new behavior; no unrelated edits; README row + link present; gofmt/vet clean.
