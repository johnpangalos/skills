# Feature flow project file

Kind: Go library (chi router, module github.com/go-chi/chi/v5).

## Checks
- `go test ./...`
- `go vet ./...`
- `gofmt -l .` (must print nothing)
- CI runs `make test` (`go test -race -v . ./middleware`)

## Conventions
- New middleware: `middleware/<name>.go` with tests in `middleware/<name>_test.go` (package middleware, uses httptest and chi).
- Add a row plus its `[Name]: https://pkg.go.dev/...#Name` link to the "Core middlewares" table in README.md.
- CHANGELOG.md only lists releases; no entry needed.

## Standing criteria
- Exported identifiers have doc comments.
- No new dependencies.

## Reviewer checklist
- Tests cover every new behavior, including hostile inputs.
- Unrelated files untouched.
- gofmt clean, `go vet` clean, `go test -race` passes.
