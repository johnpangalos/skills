package etagprobe

import (
	"bufio"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// Probes for behavior the spec leaves implicit but a careful build gets right.

func TestProbeHijack(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hj, ok := w.(http.Hijacker)
		if !ok {
			http.Error(w, "no hijack", 500)
			return
		}
		conn, buf, err := hj.Hijack()
		if err != nil {
			return
		}
		buf.WriteString("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
		buf.Flush()
		conn.Close()
	}))
	srv := httptest.NewServer(h)
	defer srv.Close()
	conn, err := net.Dial("tcp", strings.TrimPrefix(srv.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	conn.Write([]byte("GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"))
	line, _ := bufio.NewReader(conn).ReadString('\n')
	if !strings.Contains(line, "101") {
		t.Fatalf("upgrade got %q", line)
	}
}

func TestProbeFlushKeepsBody(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "hello ")
		http.NewResponseController(w).Flush()
		io.WriteString(w, "world")
	}))
	srv := httptest.NewServer(h)
	defer srv.Close()
	res, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	if string(b) != "hello world" || res.StatusCode != 200 {
		t.Fatalf("got %d %q", res.StatusCode, b)
	}
}

func TestProbeUnwrap(t *testing.T) {
	var ok bool
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok = w.(interface{ Unwrap() http.ResponseWriter })
		io.WriteString(w, "x")
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if !ok {
		t.Fatal("no Unwrap")
	}
}

func TestProbeHeadServeContent(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "a.txt", time.Time{}, strings.NewReader("hello content"))
	}))
	g := httptest.NewRecorder()
	h.ServeHTTP(g, httptest.NewRequest("GET", "/", nil))
	hd := httptest.NewRecorder()
	h.ServeHTTP(hd, httptest.NewRequest("HEAD", "/", nil))
	ge, he := g.Header().Get("ETag"), hd.Header().Get("ETag")
	if he != "" && he != ge {
		t.Fatalf("HEAD advertises %q, GET %q", he, ge)
	}
}

func TestProbeEarlyHints(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusEarlyHints)
		io.WriteString(w, "body")
	}))
	srv := httptest.NewServer(h)
	defer srv.Close()
	res, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 || res.Header.Get("ETag") == "" {
		t.Fatalf("after 103: status %d etag %q", res.StatusCode, res.Header.Get("ETag"))
	}
}

func TestProbeGarbageMember(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "abc") }))
	g := httptest.NewRecorder()
	h.ServeHTTP(g, httptest.NewRequest("GET", "/", nil))
	tag := g.Header().Get("ETag")
	for _, inm := range []string{`"x", garbage, ` + tag, `garbage, ` + tag} {
		r := httptest.NewRequest("GET", "/", nil)
		r.Header.Set("If-None-Match", inm)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		if rec.Code != 304 {
			t.Errorf("If-None-Match %q -> %d", inm, rec.Code)
		}
	}
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("If-None-Match", `*foo`)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code == 304 {
		t.Errorf("*foo treated as wildcard")
	}
}

func TestProbeNonCanonicalKey(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header()["ETag"] = []string{`"nc"`}
		io.WriteString(w, "x")
	}))
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("If-None-Match", `"nc"`)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code != 304 {
		t.Fatalf("non-canonical ETag key ignored: %d", rec.Code)
	}
}

// Answer-key probes (probes/keys.json). TestKey_<id with _ for -> fails when that keyed bug is present.

// flush-bypass: a handler's Flush must not send the buffered bytes early; the response still gets
// its ETag and a conditional request still gets 304 (as the hidden test requires).
func TestKey_flush_bypass(t *testing.T) {
	h := middleware.ETag(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "part1")
		http.NewResponseController(w).Flush()
		io.WriteString(w, "part2")
	}))
	srv := httptest.NewServer(h)
	defer srv.Close()
	res, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	res.Body.Close()
	tag := res.Header.Get("ETag")
	if res.StatusCode != 200 || string(b) != "part1part2" || tag == "" {
		t.Fatalf("after Flush: %d %q etag %q", res.StatusCode, b, tag)
	}
	req, _ := http.NewRequest("GET", srv.URL, nil)
	req.Header.Set("If-None-Match", tag)
	res2, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	b2, _ := io.ReadAll(res2.Body)
	res2.Body.Close()
	if res2.StatusCode != 304 || len(b2) != 0 {
		t.Fatalf("conditional after Flush: %d %q", res2.StatusCode, b2)
	}
}

// head-empty-etag: a HEAD that writes no body (ServeContent, Content-Length only, or neither) must
// not get a strong ETag that differs from the GET's, i.e. one hashed from the empty body.
func TestKey_head_empty_etag(t *testing.T) {
	handlers := map[string]http.HandlerFunc{
		"servecontent": func(w http.ResponseWriter, r *http.Request) {
			http.ServeContent(w, r, "a.txt", time.Time{}, strings.NewReader("hello content"))
		},
		"contentlength": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Length", "5")
			if r.Method != "HEAD" {
				io.WriteString(w, "hello")
			}
		},
		"nobody": func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "HEAD" {
				io.WriteString(w, "hello")
			}
		},
	}
	for name, hf := range handlers {
		h := middleware.ETag(hf)
		g := httptest.NewRecorder()
		h.ServeHTTP(g, httptest.NewRequest("GET", "/", nil))
		hd := httptest.NewRecorder()
		h.ServeHTTP(hd, httptest.NewRequest("HEAD", "/", nil))
		ge, he := g.Header().Get("ETag"), hd.Header().Get("ETag")
		if he != "" && he != ge {
			t.Errorf("%s: HEAD ETag %q, GET ETag %q", name, he, ge)
		}
	}
}
