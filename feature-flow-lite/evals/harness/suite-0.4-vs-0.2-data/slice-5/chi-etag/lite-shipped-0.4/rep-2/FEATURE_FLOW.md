# Feature Flow project file
Kind: Go library (HTTP router chi, stdlib only, go 1.24).
## Checks
- `go test -race ./...` ; `go vet ./...` ; `test -z "$(gofmt -l .)"`
## Conventions
- New middleware: `middleware/<name>.go` + `middleware/<name>_test.go` (stdlib testing + httptest, no testify).
- README middleware table row `| [Name] | text |` plus link `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name`.
- No CHANGELOG entry (version headings only).
- Response-writer wrappers forward optional interfaces like compress.go / wrap_writer.go.
## Reviewer checklist
- Tests cover every new behavior; no unrelated edits; package-level names don't collide (e.g. nocache.go `etagHeaders`).
- Buffering ResponseWriter wrappers: test 1xx (wrap_writer.go:84), trailers set after the body, HEAD headers vs plain net/http, and nil Content-Type suppression.
