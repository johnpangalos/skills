# Feature Flow: chi

## Kind

Library: Go HTTP router (`github.com/go-chi/chi/v5`) with an optional `middleware` package; min Go 1.24.

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`), `go vet ./...`, `gofmt -l .` (must print nothing)
- Targeted: `go test -race -run TestX ./middleware`
- Run it: `httptest` in a scratch `_test.go`, or a tiny `main` using `chi.NewRouter()` + `r.Use(middleware.X)`

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (package `middleware`), a row in README "Core middlewares" table (alphabetical-ish, `| [Name] | description |`) plus a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line below the table. CHANGELOG only lists release compare links; no entry per feature.

## Standing criteria

- The existing test suite still passes; `go vet ./...` clean; `gofmt -l .` prints nothing.
- No new dependencies outside the standard library.
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README row and link, tests next to the code).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- A middleware that wraps `http.ResponseWriter` handles the optional interfaces (`http.Flusher`, `http.Hijacker`, `io.ReaderFrom`, `Unwrap` for `http.ResponseController`) deliberately, and headers set before/after `WriteHeader` behave as without the wrapper.
- For a wrapping/buffering writer, diff raw wire output with and without it on a real `httptest.Server`: trailers (declared and `Trailer:`-prefixed, set before and after commit), Hijack before/after commit and twice, 1xx vs 101, Flush as a commit point.
- HEAD through `http.FileServer`/`http.ServeContent` writes no body; anything computed from the body must not run on an empty HEAD body.
- Middleware ordering advice in doc comments: `r.Use(A, B)` makes A the outer one; probe the stated order.
