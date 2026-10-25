"""HTTP transport. Providers call send(); tests use FakeTransport."""

from dataclasses import dataclass, field


@dataclass
class Response:
    status: int
    body: bytes = b"{}"
    headers: dict = field(default_factory=dict)


@dataclass
class Request:
    method: str
    url: str
    headers: dict
    body: bytes


class FakeTransport:
    """Returns queued responses in order and records every request."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []

    def queue(self, *responses):
        self.responses.extend(responses)

    def send(self, method, url, headers, body):
        self.requests.append(Request(method, url, dict(headers), body))
        if not self.responses:
            raise AssertionError(f"unexpected request: {method} {url}")
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item
