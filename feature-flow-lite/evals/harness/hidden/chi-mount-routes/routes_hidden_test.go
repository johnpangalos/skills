package chi

import (
	"net/http"
	"reflect"
	"slices"
	"testing"
)

// https://github.com/go-chi/chi/issues/830
func TestHiddenWalkRouteWithHandlerAndSubrouter(t *testing.T) {
	r := NewRouter()
	handler := func(w http.ResponseWriter, r *http.Request) {}

	r.Route("/foo", func(r Router) {
		r.Route("/bar", func(r Router) {
			r.Get("/{id}", handler)
		})
		r.Get("/bar", handler)
	})

	routes := map[string]bool{}
	if err := Walk(r, func(method, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		routes[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	for _, route := range []string{"GET /foo/bar", "GET /foo/bar/{id}"} {
		if !routes[route] {
			t.Fatalf("expected Walk to include %s, got %v", route, routes)
		}
	}
}

// https://github.com/go-chi/chi/issues/830
//
// Routes() must not leak the synthetic stub handler Mount() installs on
// its mount pattern: a plain Mount()/Route() should report exactly its
// "/pattern/*" entry, and a handler that collides with a mount pattern
// must be reported without also surfacing the internal stub under "*".
func TestHiddenRoutesHidesMountStub(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {}

	t.Run("plain mount reports a single subroute entry", func(t *testing.T) {
		r := NewRouter()
		r.Route("/api", func(r Router) {
			r.Get("/{id}", handler)
		})

		// Routes() isn't recursive: /api mounts a separate subrouter, so only
		// its "/api/*" connector shows here, not "/api/{id}". SubRoutes can be
		// walked further, the same way Walk() does internally.
		routes := r.Routes()
		if len(routes) != 1 {
			t.Fatalf("expected exactly 1 route, got %d: %+v", len(routes), routes)
		}
		if routes[0].Pattern != "/api/*" || routes[0].SubRoutes == nil {
			t.Fatalf("expected the single route to be the /api/* subroute, got %+v", routes[0])
		}
	})

	t.Run("handler colliding with a mount pattern hides the stub", func(t *testing.T) {
		r := NewRouter()
		r.Route("/bar", func(r Router) {
			r.Get("/{id}", handler)
		})
		r.Get("/bar", handler)

		for _, rt := range r.Routes() {
			if rt.Pattern != "/bar" {
				continue
			}
			if rt.SubRoutes != nil {
				t.Fatalf("expected /bar to have no subroutes of its own, got %+v", rt)
			}
			if len(rt.Handlers) != 1 {
				t.Fatalf("expected /bar to report exactly the GET handler, got %v", rt.Handlers)
			}
			if _, ok := rt.Handlers[http.MethodGet]; !ok {
				t.Fatalf("expected /bar to report a GET handler, got %v", rt.Handlers)
			}
		}
	})
}

// https://github.com/go-chi/chi/issues/750
//
// Middlewares registered on a Group must still reach handlers defined on a
// Route() mounted inside that group.
func TestHiddenWalkMiddlewaresAcrossGroupAndRoute(t *testing.T) {
	requestID := func(next http.Handler) http.Handler { return next }
	timeout := func(next http.Handler) http.Handler { return next }
	handler := func(w http.ResponseWriter, r *http.Request) {}

	r := NewRouter()
	r.Use(requestID)
	r.Get("/A", handler)

	r.Group(func(r Router) {
		r.Use(timeout)
		r.Get("/B", handler)
		r.Route("/C", func(r Router) {
			r.Get("/D", handler)
		})
	})

	mwName := func(f func(http.Handler) http.Handler) string {
		switch reflect.ValueOf(f).Pointer() {
		case reflect.ValueOf(requestID).Pointer():
			return "requestID"
		case reflect.ValueOf(timeout).Pointer():
			return "timeout"
		default:
			return "unknown"
		}
	}

	got := map[string][]string{}
	if err := Walk(r, func(method, route string, handler http.Handler, mws ...func(http.Handler) http.Handler) error {
		names := make([]string, len(mws))
		for i, m := range mws {
			names[i] = mwName(m)
		}
		got[method+" "+route] = names
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	want := map[string][]string{
		"GET /A":   {"requestID"},
		"GET /B":   {"requestID", "timeout"},
		"GET /C/D": {"requestID", "timeout"},
	}
	for route, wantMws := range want {
		if gotMws := got[route]; !slices.Equal(gotMws, wantMws) {
			t.Fatalf("%s: expected middlewares %v, got %v", route, wantMws, gotMws)
		}
	}
}

// A handler for another method on a mount pattern is reported too, and Mount()
// of a plain http.Handler still reports only its subtree entry.
func TestHiddenOtherMethodOnMountPattern(t *testing.T) {
	handler := func(w http.ResponseWriter, r *http.Request) {}
	r := NewRouter()
	r.Route("/bar", func(r Router) {
		r.Get("/{id}", handler)
	})
	r.Post("/bar", handler)
	r.Mount("/static", http.HandlerFunc(handler))

	routes := map[string]bool{}
	if err := Walk(r, func(method, route string, h http.Handler, mws ...func(http.Handler) http.Handler) error {
		routes[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"POST /bar", "GET /bar/{id}"} {
		if !routes[want] {
			t.Fatalf("Walk is missing %s: %v", want, routes)
		}
	}
	for route := range routes {
		if route == "GET /bar" || route == "* /bar" {
			t.Fatalf("Walk reports Mount's internal stub as %s: %v", route, routes)
		}
	}

	for _, rt := range r.Routes() {
		if rt.Pattern == "/bar" {
			if _, ok := rt.Handlers[http.MethodPost]; !ok || len(rt.Handlers) != 1 {
				t.Fatalf("expected /bar to report exactly POST, got %v", rt.Handlers)
			}
		}
		if rt.Pattern == "/static" {
			t.Fatalf("Mount of a plain handler should report /static/*, not /static: %+v", rt)
		}
	}
}
