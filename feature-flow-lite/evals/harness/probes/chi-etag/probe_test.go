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
