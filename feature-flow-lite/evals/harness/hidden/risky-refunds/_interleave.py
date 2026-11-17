"""Force thread switches inside the code under test, so check-then-act races show up.

    with interleaved("shop"):
        ... start threads that call into shop/ ...

Every line executed in a module whose path contains /<package>/ yields the GIL first
(time.sleep(0)), in every thread started inside the block. A build that checks and then
writes shared state without a lock loses the race nearly every time; one that holds a lock
across the check and the write is unaffected. It doesn't depend on how the build is written.
"""
import contextlib, os, sys, threading, time


@contextlib.contextmanager
def interleaved(package):
    marker = f"{os.sep}{package}{os.sep}"

    def local(frame, event, arg):
        if event == "line":
            time.sleep(0)
        return local

    def tracer(frame, event, arg):
        return local if marker in frame.f_code.co_filename else None

    old = sys.getswitchinterval()
    sys.setswitchinterval(1e-6)
    threading.settrace(tracer)
    try:
        yield
    finally:
        threading.settrace(None)
        sys.setswitchinterval(old)


def race(fn, n=8):
    """Run fn() in n threads released together; return the list of results (exceptions included)."""
    barrier = threading.Barrier(n)
    out, lock = [], threading.Lock()

    def run():
        barrier.wait()
        try:
            r = fn()
        except Exception as e:  # noqa: BLE001 - recorded for the caller
            r = e
        with lock:
            out.append(r)

    ts = [threading.Thread(target=run) for _ in range(n)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    return out
