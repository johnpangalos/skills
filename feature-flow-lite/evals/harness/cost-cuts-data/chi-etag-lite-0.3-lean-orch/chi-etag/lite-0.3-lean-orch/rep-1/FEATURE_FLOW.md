# Feature Flow: chi

<!-- Written by feature-flow-lite on its first run in this repo, then kept up to date by its
runs. Edit it like a CLAUDE.md: anything here holds for every feature-flow run in this repo.
Keep it short; a line nobody would act on is noise. -->

## Kind

Existing codebase of a library: Go HTTP router (`github.com/go-chi/chi/v5`), go 1.24, CI on Go 1.24–1.27, linux and windows.

## Checks

- Full: `go vet ./...`; `test -z "$(gofmt -l .)"`; `go test -race ./...` (CI runs `make test`, i.e. `go test -race -v .` and `./middleware`; vet and gofmt are not in CI but are required here)
- Targeted: `go test -race -run <TestName> ./middleware`
- Run it: library; probe with `httptest` in a scratch `_test.go` or a `go run` program importing `github.com/go-chi/chi/v5/middleware` via the module path

## Conventions

- New middleware: `middleware/<name>.go` with a doc comment on the exported func, tests in `middleware/<name>_test.go` (`package middleware`, `httptest`, helper `testRequest` in middleware_test.go), a row in README.md's "Core middlewares" table with its column padding kept aligned, and a `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` link in the link block below the table. CHANGELOG.md has no Unreleased section; don't add entries.
- A middleware that wraps `http.ResponseWriter` forwards the optional interfaces the underlying writer has (Flusher, Hijacker, Pusher, ReaderFrom; see wrap_writer.go and compress.go) or documents why not.

## Standing criteria

- The existing test suite still passes; vet and gofmt are clean.
- A new public feature follows the Conventions above.
- No new dependencies outside the standard library.

## Reviewer checklist

- The change follows the patterns around it (naming, doc comments, README table and link, tests next to the code).
- Anything the sibling named in FILES does that the new code should and doesn't is a finding.
- A response-writer wrapper: compare output with and without it (status, headers, body, Flush/Hijack, WriteHeader called twice, no write at all).
- A buffering wrapper must follow net/http's commit rules: 1xx statuses are not final, headers are fixed at the commit and trailers are sent with their live values, HEAD keeps Content-Length, and a status already written is flushed before Hijack. Also check HEAD on handlers that skip the body, such as http.FileServer.
