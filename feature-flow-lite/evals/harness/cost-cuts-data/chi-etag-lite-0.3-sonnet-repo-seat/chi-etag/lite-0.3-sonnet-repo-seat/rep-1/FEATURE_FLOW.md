# Feature Flow: chi

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase of a Go library: the chi HTTP router (`github.com/go-chi/chi/v5`), Go 1.24+, stdlib only.

## Checks

- Full: `go vet ./...`; `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`); `gofmt -l .` must print nothing
- Targeted: `go test -race -run <TestName> ./middleware`
- Run it: write a throwaway `_test.go` or `go run` program using `httptest.NewServer(r)` with the middleware mounted on a `chi.NewRouter()`

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, using `testRequest`/`httptest` helpers), a row in the README middleware table (`| [Name] | description |`) and a link definition `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` in the link list below it. No CHANGELOG entry (CHANGELOG only links release diffs).
- Middleware that wraps `http.ResponseWriter`: look at `wrap_writer.go` and `compress.go` for which optional interfaces (Flusher, Hijacker, Pusher, ReaderFrom, Unwrap) are forwarded.

## Standing criteria

- The existing test suite still passes; `go vet ./...` clean; `gofmt -l .` empty.
- A new public feature follows the Conventions above; no new dependencies in go.mod.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table row and link).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Response-writer wrappers: behaviour with Flush, Hijack, ReaderFrom, `http.ResponseController` (Unwrap), WriteHeader called twice, 1xx informational headers, Write without WriteHeader.
- Buffering wrappers: compare raw wire bytes with and without the wrapper for Hijack after WriteHeader (101 and 200), a Hijack that fails followed by more writes, a 1xx after the final status, Write return values (ErrBodyNotAllowed, ErrHijacked), and trailers.
- HEAD: `http.FileServer`/`http.ServeContent` write no body on HEAD; anything derived from the body (hashes, lengths) must not be computed from an empty HEAD buffer.
- Ordering advice in doc comments: in `r.Use(A, B)`, A is outermost; check any "put X inside/outside Y" sentence with a probe.
