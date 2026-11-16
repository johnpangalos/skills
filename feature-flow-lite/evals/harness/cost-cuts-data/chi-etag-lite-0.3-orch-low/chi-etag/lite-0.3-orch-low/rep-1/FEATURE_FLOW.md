# Feature Flow: chi

## Kind

Existing codebase of a Go library (HTTP router + middleware package), Go 1.24+.

## Checks

- Full: `go test -race ./...`; `go vet ./...`; `gofmt -l .` (must print nothing)
- Targeted: `go test -race ./middleware -run <Name>`
- Run it: write an `httptest` probe in a scratch `_test.go` or `go run` program importing `github.com/go-chi/chi/v5/middleware`.

## Conventions

- New middleware: `middleware/<name>.go` with doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`), a row in README.md's middleware table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line in the alphabetical link list.
- Response-writer wrappers reuse or mirror `middleware/wrap_writer.go` (forward Flusher/Hijacker/ReaderFrom/Pusher where meaningful).

## Standing criteria

- The existing test suite still passes; no new dependencies (stdlib only).
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, registration, docs, README table and link).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Buffering wrappers: 1xx (Early Hints) not latched as final status; Hijack, Pusher and Unwrap (deadlines) forwarded; trailers survive; HEAD headers match plain HEAD (no invented Content-Length).
- Wrappers: behavior compared with and without the middleware for the same handler (headers, status, body, Flush/Hijack, WriteHeader-twice, no-write handlers).
