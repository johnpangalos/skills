# Feature Flow project file

Kind: Go library (HTTP router `chi` and its `middleware` package). Go 1.24 floor (go.mod); CI tests 1.24–1.27 on Ubuntu and Windows.

## Checks
- `go test -race ./...`
- `go vet ./...`
- `test -z "$(gofmt -l .)"`

## Conventions
- New middleware: `middleware/<name>.go` with godoc on the exported func, tests in `middleware/<name>_test.go` (use `testRequest` helpers from `middleware_test.go` or `httptest`).
- New middleware gets a row in README.md's core middleware table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link definition.
- CHANGELOG.md holds only release headers; no per-change entry.
- Middlewares that wrap the ResponseWriter handle Flush/Hijack/Push/Unwrap like `compress.go` / `wrap_writer.go`.
- Use only stdlib APIs available in Go 1.24.

## Reviewer checklist
- gofmt, vet, race-tested; no new dependencies.
- README table row and link added; godoc accurate.
- Every new behavior has a test.
- ResponseWriter wrappers: compare with/without the wrapper on a real httptest server — hijack (no writes after), ResponseController.Flush via Unwrap-only outer writers, 101, trailers (declared and TrailerPrefix), headers set after WriteHeader.
