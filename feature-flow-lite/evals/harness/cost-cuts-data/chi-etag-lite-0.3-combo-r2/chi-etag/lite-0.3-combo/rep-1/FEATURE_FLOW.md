# Feature Flow: chi

## Kind

Library: Go HTTP router (github.com/go-chi/chi/v5) with a `middleware` package.

## Checks

- Full: `go test -race ./...`, `go vet ./...`, `test -z "$(gofmt -l .)"` (CI runs `make test` = race tests of `.` and `./middleware` on Go 1.24-1.27)
- Targeted: `go test -race ./middleware -run <TestName>`
- Run it: `go test` with `httptest`; no app to start.

## Conventions

- New middleware: `middleware/<name>.go` with godoc, tests in `middleware/<name>_test.go` (package middleware, chi.NewRouter + httptest), a row in README.md "Core middlewares" table plus its `[Name]: https://pkg.go.dev/github.com/go-chi/chi/v5/middleware#Name` reference link in alphabetical order. CHANGELOG.md has release headings only; no entry per change.

## Standing criteria

- No new dependencies; stdlib only. Go 1.24 compatible.
- A ResponseWriter wrapper forwards or deliberately handles every optional interface (Flusher, Hijacker, Pusher, io.ReaderFrom, Unwrap), as `compress.go`/`wrap_writer.go` do.

## Reviewer checklist

- Run the full checks with -race.
- Compare responses with and without the middleware for pass-through cases (status, headers, body, trailers).
- Every exported identifier has a godoc comment; README row and link present.
