package etaghidden

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func server(t *testing.T) *httptest.Server {
	t.Helper()
	r := chi.NewRouter()
	r.Use(middleware.ETag)
	hello := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("X-Custom", "kept")
		w.Write([]byte("hello"))
	}
	r.Get("/hello", hello)
	r.Head("/hello", hello)
	r.Get("/hello-split", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("hel"))
		w.Write([]byte("lo"))
	})
	r.Get("/explicit", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("explicit"))
	})
	r.Get("/echo/{s}", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("body-" + chi.URLParam(r, "s")))
	})
	r.Get("/missing", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("not here"))
	})
	r.Get("/created", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("made"))
	})
	r.Get("/own", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", `"v42"`)
		w.Write([]byte("own tag"))
	})
	r.Post("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("posted"))
	})
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

type result struct {
	status int
	etag   string
	body   string
	header http.Header
}

func do(t *testing.T, srv *httptest.Server, method, path string, inm ...string) result {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range inm {
		req.Header.Add("If-None-Match", v)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return result{resp.StatusCode, resp.Header.Get("ETag"), string(body), resp.Header}
}

func strongTag(t *testing.T, tag string) {
	t.Helper()
	if strings.HasPrefix(tag, "W/") {
		t.Fatalf("ETag %q should be strong", tag)
	}
	if len(tag) < 3 || tag[0] != '"' || tag[len(tag)-1] != '"' || strings.Contains(tag[1:len(tag)-1], `"`) {
		t.Fatalf("ETag %q is not a quoted entity tag", tag)
	}
}

func TestGetGetsStrongETagAndFullBody(t *testing.T) {
	srv := server(t)
	r := do(t, srv, "GET", "/hello")
	if r.status != 200 || r.body != "hello" {
		t.Fatalf("got %d %q", r.status, r.body)
	}
	strongTag(t, r.etag)
	if r.header.Get("Content-Type") != "text/plain" || r.header.Get("X-Custom") != "kept" {
		t.Fatalf("handler headers lost: %v", r.header)
	}
}

func TestTagDependsOnlyOnBody(t *testing.T) {
	srv := server(t)
	a, b, c := do(t, srv, "GET", "/hello"), do(t, srv, "GET", "/hello-split"), do(t, srv, "GET", "/hello")
	if a.etag != c.etag {
		t.Fatalf("same body, different tags: %q %q", a.etag, c.etag)
	}
	if a.etag != b.etag || b.body != "hello" {
		t.Fatalf("split writes should hash like one write: %q %q body %q", a.etag, b.etag, b.body)
	}
	x, y := do(t, srv, "GET", "/echo/x"), do(t, srv, "GET", "/echo/y")
	if x.etag == y.etag {
		t.Fatalf("different bodies share tag %q", x.etag)
	}
}

func TestExplicitWriteHeader200GetsTag(t *testing.T) {
	r := do(t, server(t), "GET", "/explicit")
	if r.status != 200 || r.body != "explicit" || r.etag == "" {
		t.Fatalf("got %d %q etag %q", r.status, r.body, r.etag)
	}
}

func TestIfNoneMatch(t *testing.T) {
	srv := server(t)
	tag := do(t, srv, "GET", "/hello").etag
	cases := []struct {
		name string
		inm  []string
		want int
	}{
		{"exact", []string{tag}, 304},
		{"weak form", []string{"W/" + tag}, 304},
		{"in a list", []string{`"nope", ` + tag + `, "other"`}, 304},
		{"list without spaces", []string{`"nope",` + tag}, 304},
		{"star", []string{"*"}, 304},
		{"second header line", []string{`"nope"`, tag}, 304},
		{"no match", []string{`"nope", W/"other"`}, 200},
		{"tag as substring only", []string{strings.TrimSuffix(tag, `"`) + `x"`}, 200},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := do(t, srv, "GET", "/hello", c.inm...)
			if r.status != c.want {
				t.Fatalf("If-None-Match %q: status %d, want %d", c.inm, r.status, c.want)
			}
			if c.want == 304 {
				if r.body != "" {
					t.Fatalf("304 carried a body: %q", r.body)
				}
				if r.etag != tag {
					t.Fatalf("304 should repeat the ETag %q, got %q", tag, r.etag)
				}
			} else if r.body != "hello" {
				t.Fatalf("200 body %q", r.body)
			}
		})
	}
}

func TestHeadMatchesGet(t *testing.T) {
	srv := server(t)
	get, head := do(t, srv, "GET", "/hello"), do(t, srv, "HEAD", "/hello")
	if head.status != 200 || head.etag != get.etag {
		t.Fatalf("HEAD %d etag %q, GET etag %q", head.status, head.etag, get.etag)
	}
	if r := do(t, srv, "HEAD", "/hello", get.etag); r.status != 304 {
		t.Fatalf("conditional HEAD: %d", r.status)
	}
}

func TestOtherMethodsPassThrough(t *testing.T) {
	srv := server(t)
	r := do(t, srv, "POST", "/hello", "*")
	if r.status != 201 || r.body != "posted" || r.etag != "" {
		t.Fatalf("POST: %d %q etag %q", r.status, r.body, r.etag)
	}
}

func TestNon200PassThrough(t *testing.T) {
	srv := server(t)
	for _, path := range []string{"/missing", "/created"} {
		plain := do(t, srv, "GET", path)
		cond := do(t, srv, "GET", path, "*")
		for _, r := range []result{plain, cond} {
			if r.etag != "" {
				t.Fatalf("%s got ETag %q", path, r.etag)
			}
			if r.status == 304 || r.status == 200 {
				t.Fatalf("%s: status %d", path, r.status)
			}
		}
		if plain.body == "" || plain.body != cond.body {
			t.Fatalf("%s bodies %q / %q", path, plain.body, cond.body)
		}
	}
}

func TestHandlerETagIsKeptAndHonored(t *testing.T) {
	srv := server(t)
	r := do(t, srv, "GET", "/own")
	if r.etag != `"v42"` || r.body != "own tag" {
		t.Fatalf("got etag %q body %q", r.etag, r.body)
	}
	if r := do(t, srv, "GET", "/own", `"v42"`); r.status != 304 {
		t.Fatalf("If-None-Match on handler tag: %d", r.status)
	}
	if r := do(t, srv, "GET", "/own", `W/"v42"`); r.status != 304 {
		t.Fatalf("weak If-None-Match on handler tag: %d", r.status)
	}
}

func TestConcurrentRequests(t *testing.T) {
	srv := server(t)
	want := map[string]string{}
	for i := 0; i < 20; i++ {
		s := fmt.Sprint(i)
		want[s] = do(t, srv, "GET", "/echo/"+s).etag
	}
	var wg sync.WaitGroup
	errs := make(chan string, 400)
	for n := 0; n < 10; n++ {
		for s, tag := range want {
			wg.Add(1)
			go func(s, tag string) {
				defer wg.Done()
				r := do(t, srv, "GET", "/echo/"+s)
				if r.etag != tag || r.body != "body-"+s {
					errs <- fmt.Sprintf("/echo/%s: etag %q want %q body %q", s, r.etag, tag, r.body)
				}
			}(s, tag)
		}
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Fatal(e)
	}
}
