# Feature Flow: chi

## Kind

Library: Go HTTP router (`github.com/go-chi/chi/v5`) plus its `middleware` package; stdlib only, Go 1.24+.

## Checks

- Full: `go test -race ./...`; `go vet ./...`; `gofmt -l .` (must print nothing)
- Targeted: `go test -race -run TestName ./middleware`
- Run it: write a probe `_test.go` in `middleware/` using `httptest` (delete it afterwards)

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, `httptest`), a row in the README "Core middlewares" table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link in the link list below it. CHANGELOG.md is release-only; don't edit it.
- A middleware that wraps the ResponseWriter forwards http.Flusher, http.Hijacker, http.Pusher and `Unwrap()` the way `compress.go`'s `compressResponseWriter` does.
- No new dependencies (go.mod has none).

## Standing criteria

- The existing test suite, `go vet` and gofmt still pass.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README row and link).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Response-writer wrappers: Flush, Hijack, Push, Unwrap, implicit 200 on first Write, WriteHeader called twice.
- Buffering wrappers: after Hijack nothing may be written to the writer again (server logs "response.Write on hijacked connection"); compare the wire against a no-middleware baseline over a raw TCP client.
