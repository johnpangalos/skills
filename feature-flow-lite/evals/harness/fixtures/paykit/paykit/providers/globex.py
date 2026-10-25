"""Globex Pay provider.

API reference: https://developer.globex.example/payments
"""

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from paykit.errors import (
    CardDeclined,
    InvalidRequest,
    PaymentError,
    ProviderUnavailable,
    RateLimited,
    SignatureError,
)
from paykit.money import supported, to_decimal_string

BASE_URL = "https://pay.globex.example"
USER_AGENT = "paykit-globex/1.4"
WEBHOOK_TOLERANCE_SECONDS = 300

# Globex error codes -> paykit errors
ERROR_CODES = {
    "DECLINED": CardDeclined,
    "THROTTLED": RateLimited,
    "BAD_REQUEST": InvalidRequest,
}

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

STATUS_MAP = {
    "SUCCEEDED": "succeeded",
    "FAILED": "failed",
    "PROCESSING": "pending",
}


@dataclass
class GlobexCharge:
    id: str
    amount: Decimal
    currency: str
    status: str
    source: str
    idempotency_key: str
    description: str = ""
    metadata: dict = field(default_factory=dict)
    raw: dict = field(default_factory=dict)


@dataclass
class GlobexRefund:
    id: str
    charge_id: str
    amount: Decimal
    currency: str
    status: str
    idempotency_key: str
    raw: dict = field(default_factory=dict)


@dataclass
class GlobexEvent:
    id: str
    type: str
    data: dict
    created: int
    raw: dict = field(default_factory=dict)


class GlobexPay:
    """Client for Globex Pay.

    Amounts are Decimals in major units (12.50 EUR); Globex takes decimal
    strings ("12.50"). Retries 429 and 5xx responses and connection errors with exponential
    backoff, reusing the same idempotency key on every attempt.
    """

    name = "globex"

    def __init__(self, api_key, secret, webhook_secret, transport, max_retries=3,
                 backoff=0.5, sleep=time.sleep, clock=time.time):
        if not api_key or not secret:
            raise ValueError("api_key and secret are required")
        self.api_key = api_key
        self.secret = secret
        self.webhook_secret = webhook_secret
        self.transport = transport
        self.max_retries = max_retries
        self.backoff = backoff
        self.sleep = sleep
        self.clock = clock

    # --- public API -------------------------------------------------------------

    def charge(self, amount, currency, source, idempotency_key=None, description="", metadata=None):
        """Charge `amount` of `currency` to `source`. Returns an GlobexCharge."""
        amount = Decimal(amount)
        if amount <= 0:
            raise InvalidRequest("amount must be positive")
        if not supported(currency):
            raise InvalidRequest(f"unsupported currency {currency!r}")
        if not source:
            raise InvalidRequest("source is required")
        key = idempotency_key or self._new_key()
        body = {
            "amount": to_decimal_string(amount, currency),
            "currency": currency.upper(),
            "source": source,
            "description": description,
            "metadata": metadata or {},
        }
        data = self._request("POST", "/api/payments", body, key)
        return self._parse_charge(data, key)

    def refund(self, charge_id, amount=None, currency=None, idempotency_key=None):
        """Refund all of a charge, or `amount` of it. Returns an GlobexRefund."""
        if not charge_id:
            raise InvalidRequest("charge_id is required")
        body = {}
        if amount is not None:
            amount = Decimal(amount)
            if amount <= 0:
                raise InvalidRequest("refund amount must be positive")
            if not currency or not supported(currency):
                raise InvalidRequest("a supported currency is required with a partial refund")
            body["amount"] = to_decimal_string(amount, currency)
        key = idempotency_key or self._new_key()
        data = self._request("POST", f"/api/payments/{charge_id}/refunds", body, key)
        return self._parse_refund(data, key)

    def get_charge(self, charge_id):
        """Fetch a charge by id. Returns an GlobexCharge."""
        if not charge_id:
            raise InvalidRequest("charge_id is required")
        data = self._request("GET", f"/api/payments/{charge_id}", None)
        return self._parse_charge(data, data.get("idempotency_key", ""))

    def verify_webhook(self, payload, headers):
        """Check a webhook's signature and age, and return its GlobexEvent."""
        signature = headers.get("Globex-Webhook-Sig")
        timestamp = headers.get("Globex-Timestamp")
        if not signature or not timestamp:
            raise SignatureError("missing webhook signature headers")
        try:
            age = self.clock() - int(timestamp)
        except ValueError:
            raise SignatureError("bad webhook timestamp") from None
        if age > WEBHOOK_TOLERANCE_SECONDS:
            raise SignatureError("webhook is too old")
        digest = hmac.new(self.webhook_secret.encode(), timestamp.encode() + b"." + payload, hashlib.sha512).digest()
        expected = base64.b64encode(digest).decode()
        if not hmac.compare_digest(expected, signature):
            raise SignatureError("webhook signature does not match")
        try:
            data = json.loads(payload)
        except ValueError:
            raise SignatureError("webhook payload is not JSON") from None
        return GlobexEvent(
            id=data["eventId"],
            type=data["eventType"],
            data=data.get("resource", {}),
            created=int(data.get("timestamp", 0)),
            raw=data,
        )

    # --- internals --------------------------------------------------------------

    def _new_key(self):
        return "gbx_" + uuid.uuid4().hex

    def _sign(self, timestamp, body):
        digest = hmac.new(self.secret.encode(), timestamp.encode() + b"." + body, hashlib.sha512).digest()
        return base64.b64encode(digest).decode()

    def _headers(self, method, path, body, key):
        timestamp = str(int(self.clock()))
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "Globex-Timestamp": timestamp,
            "Globex-Sig": self._sign(timestamp, body),
        }
        if key:
            headers["Idempotency-Key"] = key
        return headers

    def _encode(self, body):
        if body is None:
            return b""
        return json.dumps(body, sort_keys=True, separators=(",", ":")).encode()

    def _request(self, method, path, body, key=None):
        payload = self._encode(body)
        attempt = 0
        while True:
            error = None
            try:
                resp = self.transport.send(method, BASE_URL + path, self._headers(method, path, payload, key), payload)
            except ConnectionError as exc:
                resp, error = None, exc
            if resp is not None and resp.status < 400:
                return self._decode(resp)
            if resp is not None and resp.status not in RETRYABLE_STATUS:
                raise self._error(resp)
            if attempt >= self.max_retries:
                if resp is None:
                    raise ProviderUnavailable(f"globex: connection failed after {attempt + 1} attempts") from error
                if resp.status == 429:
                    raise RateLimited("globex: rate limited", status=429, code="THROTTLED")
                raise ProviderUnavailable(f"globex: HTTP {resp.status} after {attempt + 1} attempts", status=resp.status)
            self.sleep(self.backoff * (2 ** attempt))
            attempt += 1

    def _decode(self, resp):
        try:
            return json.loads(resp.body or b"{}")
        except ValueError:
            raise ProviderUnavailable("globex: response is not JSON", status=resp.status) from None

    def _error(self, resp):
        try:
            err = json.loads(resp.body or b"{}")
        except ValueError:
            err = {}
        code = err.get("code", "")
        message = err.get("detail") or f"HTTP {resp.status}"
        cls = ERROR_CODES.get(code, PaymentError)
        return cls(f"globex: {message}", status=resp.status, code=code)

    def _parse_charge(self, data, key):
        currency = data["currency"].upper()
        return GlobexCharge(
            id=data["paymentId"],
            amount=Decimal(data["amount"]),
            currency=currency,
            status=STATUS_MAP.get(data.get("state"), "pending"),
            source=data.get("source", ""),
            idempotency_key=key,
            description=data.get("description", ""),
            metadata=data.get("metadata") or {},
            raw=data,
        )

    def _parse_refund(self, data, key):
        currency = data["currency"].upper()
        return GlobexRefund(
            id=data["refundId"],
            charge_id=data["paymentId"],
            amount=Decimal(data["amount"]),
            currency=currency,
            status=STATUS_MAP.get(data.get("state"), "pending"),
            idempotency_key=key,
            raw=data,
        )
