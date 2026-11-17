package chiprobe

// Answer-key probes for chi-mount-routes (probes/keys.json), against the public chi API only.
// TestKey_<id with _ for -> fails when that keyed bug is present.

import (
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"

	"github.com/go-chi/chi/v5"
)

func h(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(name)) }
}

func walk(t *testing.T, r chi.Routes) map[string]bool {
	t.Helper()
	got := map[string]bool{}
	if err := chi.Walk(r, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		got[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return got
}

func keys(m map[string]bool) []string {
	var s []string
	for k := range m {
		s = append(s, k)
	}
	sort.Strings(s)
	return s
}

func serve(r http.Handler, method, path string) string {
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec.Body.String()
}

func mounted() (chi.Router, chi.Router) {
	r := chi.NewRouter()
	sub := chi.NewRouter()
	sub.Get("/x", h("sub"))
	r.Mount("/m", sub)
	return r, sub
}

// mount-wildcard: a route registered on the mount's own wildcard pattern is reported, and a
// subrouter that Handle on that pattern shadows for every method is no longer listed.
func TestKey_mount_wildcard(t *testing.T) {
	r, _ := mounted()
	r.Get("/m/*", h("wild"))
	if serve(r, "GET", "/m/x") != "wild" {
		t.Skip("routing changed: GET /m/x no longer reaches the wildcard handler")
	}
	if got := walk(t, r); !got["GET /m/*"] {
		t.Errorf("Get on the mount wildcard: Walk misses GET /m/*: %v", keys(got))
	}

	r, _ = mounted()
	r.Handle("/m/*", h("wild"))
	if serve(r, "GET", "/m/x") != "wild" {
		t.Skip("routing changed: GET /m/x no longer reaches the wildcard handler")
	}
	got := walk(t, r)
	if !got["GET /m/*"] {
		t.Errorf("Handle on the mount wildcard: Walk misses GET /m/*: %v", keys(got))
	}
	if got["GET /m/x"] {
		t.Errorf("Handle on the mount wildcard shadows the subrouter, but Walk still lists GET /m/x: %v", keys(got))
	}
}

// empty-handler-route: no Route that Routes() returns (at any depth) has an empty Handlers map.
func TestKey_empty_handler_route(t *testing.T) {
	builds := map[string]func() chi.Router{
		"spec": func() chi.Router {
			r := chi.NewRouter()
			r.Route("/foo", func(r chi.Router) {
				r.Route("/bar", func(r chi.Router) { r.Get("/{id}", h("id")) })
				r.Get("/bar", h("bar"))
			})
			return r
		},
		"mount+post": func() chi.Router { r, _ := mounted(); r.Post("/m", h("post")); return r },
		"mount+get-wild": func() chi.Router { r, _ := mounted(); r.Get("/m/*", h("wild")); return r },
		"mount+handle-wild": func() chi.Router { r, _ := mounted(); r.Handle("/m/*", h("wild")); return r },
		"plain": func() chi.Router {
			r := chi.NewRouter()
			r.Route("/api", func(r chi.Router) { r.Get("/{id}", h("id")) })
			r.Get("/", h("root"))
			return r
		},
	}
	var check func(name, prefix string, rs []chi.Route)
	check = func(name, prefix string, rs []chi.Route) {
		for _, rt := range rs {
			if len(rt.Handlers) == 0 {
				t.Errorf("%s: Routes() has %s%s with no handlers (SubRoutes set: %v)", name, prefix, rt.Pattern, rt.SubRoutes != nil)
			}
			if rt.SubRoutes != nil {
				check(name, prefix+rt.Pattern, rt.SubRoutes.Routes())
			}
		}
	}
	for name, b := range builds {
		check(name, "", b().Routes())
	}
}
