# Feature Flow: chi

## Kind

Library: Go HTTP router (`github.com/go-chi/chi/v5`) with a `middleware` subpackage; stdlib only, Go 1.24+.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`), `go vet ./...`, `test -z "$(gofmt -l .)"`
- Targeted: `go test -race -run TestXxx ./middleware`
- Run it: write a probe `_test.go` in `middleware/` using `httptest.NewRecorder` or `httptest.NewServer` with a `chi.NewRouter()`

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`), a row in README's "Core middlewares" table (alphabetical-ish) plus a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line below it. CHANGELOG.md is release-only; don't edit it.
- No new dependencies (go.mod has none).

## Standing criteria

- The existing test suite still passes with `-race`; `go vet` and `gofmt -l` are clean.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table + link, tests next to the code).
- A middleware that wraps `http.ResponseWriter` handles every optional interface the way `middleware/compress.go` does (Flush, Hijack, Push, Unwrap for `http.ResponseController`), with the same error wording.
- A writer wrapper that buffers: 101 is a final status (not informational, as in `wrap_writer.go`), and Hijack must flush pending buffered output first but write nothing when nothing was written.
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
