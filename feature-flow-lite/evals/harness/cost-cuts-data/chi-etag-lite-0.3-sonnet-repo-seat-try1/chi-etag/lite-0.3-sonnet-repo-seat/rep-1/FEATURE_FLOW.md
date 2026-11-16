# Feature Flow: chi

## Kind

Library (existing codebase): go-chi/chi v5 HTTP router and its `middleware` package; Go (go.mod `go 1.24`, CI matrix 1.24–1.27).

## Checks

- Full: `go test ./...`
- Full: `go test -race ./middleware .` (CI runs `make test`, which uses `-race`)
- Full: `go vet ./...`
- Full: `gofmt -l .` (must print nothing)
- Targeted: `go test -race -run <TestName> ./middleware`
- Run it: `go test ./middleware -run <TestName> -v`, or an `httptest.NewServer` with a chi router in a scratch test

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`, using `testRequest`/`httptest` helpers from `middleware_test.go`), a row in README.md's "Core middlewares" table and a matching `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line below it. CHANGELOG.md only lists releases; no entry per change.
- Middleware wrapping the ResponseWriter: keep the optional interfaces working (Flusher, Hijacker, Pusher, io.ReaderFrom, `Unwrap()` for `http.ResponseController`), see `middleware/wrap_writer.go` and `middleware/compress.go`.
- Must build on the oldest Go in CI (1.24): no stdlib APIs newer than that.

## Standing criteria

- The existing test suite still passes; `go vet ./...` is clean; `gofmt -l .` prints nothing.
- A new public middleware follows the Conventions above (file, test file, README row and link).

## Reviewer checklist

- The change follows the patterns around it (naming, doc comment, README row and link, test file).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- Wrapped ResponseWriters: headers written before/after WriteHeader, implicit 200 on first Write, multiple WriteHeader calls, Flush/Hijack/Unwrap behavior.
- Tests run with `-race`.
- Buffering wrappers: diff GET *and* HEAD against a plain server (HEAD must keep net/http's derived Content-Length/Content-Type; `http.FileServer` HEAD declares a Content-Length and writes nothing), and honour a declared Content-Length (`http.ErrContentLength`) as net/http does.
