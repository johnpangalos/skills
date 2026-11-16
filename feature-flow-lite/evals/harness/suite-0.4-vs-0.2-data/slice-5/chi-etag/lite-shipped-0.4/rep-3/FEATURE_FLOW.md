# Feature flow: go-chi/chi

Kind: Go library (HTTP router + middleware package). Go 1.24 (CI 1.24–1.27, linux+windows).

## Checks
- `go test ./...` (Makefile uses `go test -race -v .` and `./middleware`)
- `go vet ./...`
- `test -z "$(gofmt -l .)"`

## Conventions
- New middleware: `middleware/<name>.go` with `<name>_test.go` next to it; doc comment on the exported func.
- README middleware table (`README.md` ~340): add `| [Name] | description |` row and a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link ref.
- Response-writer wrappers: see `compress.go` / `wrap_writer.go` for optional interfaces (Flusher, Hijacker, Pusher, Unwrap).
- No new dependencies (stdlib only).

## Standing criteria
- Public API documented; behaviour tested with httptest.

## Reviewer checklist
- gofmt/vet clean, tests next to code, README row + link, no unrelated edits, no new deps.
