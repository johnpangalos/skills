# Feature Flow: chi

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase of a library: Go HTTP router (`github.com/go-chi/chi/v5`, go 1.24, stdlib only).

## Checks

- Full: `go test -race ./...` (CI runs `make test`: `go test -race -v .` and `go test -race -v ./middleware`); `go vet ./...`; `gofmt -l .` must print nothing
- Targeted: `go test -race ./middleware -run <TestName>`
- Run it: no app; probe with `httptest` in a throwaway `_test.go` or `go run` program

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (use `testRequest` from `middleware_test.go` with `chi.NewRouter()` + `httptest.NewServer`, or `httptest.NewRecorder`), a row in README's "Core middlewares" table and its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link line. No CHANGELOG entry (it only lists releases).
- A middleware that wraps `http.ResponseWriter`: see `middleware/compress.go` (`compressResponseWriter`): forwards Flush, Hijack, Push and exposes `Unwrap()` for `http.ResponseController`.
- Package-level names are shared across the `middleware` package (e.g. `etagHeaders` in nocache.go); check for collisions.

## Standing criteria

- The existing test suite still passes, with `-race`.
- No new dependencies (stdlib only).
- A new public feature follows the Conventions above.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table + link, tests next to the code).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding (for ResponseWriter wrappers: Flush, Hijack, Push, Unwrap, 1xx informational responses).
- `go vet ./...` and `gofmt -l .` are clean.
- A buffering ResponseWriter wrapper is diffed byte-for-byte against plain net/http (raw TCP) for: trailers (declared and `http.TrailerPrefix`, set or deleted after WriteHeader), 1xx before and after the final status, a too-short Content-Length, Write errors after 204/304/Hijack, Write then Hijack, a failed Hijack, superfluous and invalid WriteHeader codes.
