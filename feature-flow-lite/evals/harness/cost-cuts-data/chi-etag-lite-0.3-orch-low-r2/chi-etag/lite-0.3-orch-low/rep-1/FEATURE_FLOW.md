# Feature Flow: chi

## Kind

Existing codebase of a Go library (HTTP router `github.com/go-chi/chi/v5` + `middleware` package); go 1.24, no third-party deps.

## Checks

- Full: `go test -race ./...` ; `go vet ./...` ; `gofmt -l .` (must print nothing)
- Targeted: `go test -race ./middleware -run <TestName>`
- Run it: write a probe `_test.go` or `go run` program using `httptest` against the handler.

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`), a row in README's "chi/middleware Handler" table plus a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link definition in the block below it. No CHANGELOG entry for unreleased work.
- Response-writer wrappers: forward optional interfaces (Flusher, Hijacker, Pusher, io.ReaderFrom) like `middleware/wrap_writer.go` / `compress.go` do, or document why not.

## Standing criteria

- The existing test suite still passes; `go vet` and `gofmt -l` are clean.
- No new dependencies; stays compatible with go 1.24.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table and link).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Response wrappers: header mutations after WriteHeader, multiple WriteHeader calls, Write without WriteHeader, Flush/Hijack behaviour, HEAD with no body.
- Buffering wrappers: compare the same handler with and without the wrapper on a real `httptest.NewServer`, not only `ResponseRecorder`. The recorder hides lost HEAD Content-Length/Content-Type, dropped trailers, and `Write` errors (`ErrBodyNotAllowed`, `ErrHijacked`) the handler sees.
