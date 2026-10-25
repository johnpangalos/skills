"""Acme Pay provider.

API reference: https://docs.acmepay.example/v1
"""

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
from paykit.money import from_minor, supported, to_minor

BASE_URL = "https://api.acmepay.example"
USER_AGENT = "paykit-acme/1.4"
WEBHOOK_TOLERANCE_SECONDS = 300

# Acme error codes -> paykit errors
ERROR_CODES = {
    "card_declined": CardDeclined,
    "rate_limited": RateLimited,
    "invalid_request": InvalidRequest,
}

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

STATUS_MAP = {
    "succeeded": "succeeded",
    "failed": "failed",
    "pending": "pending",
}


@dataclass
class AcmeCharge:
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
class AcmeRefund:
    id: str
    charge_id: str
    amount: Decimal
    currency: str
    status: str
    idempotency_key: str
    raw: dict = field(default_factory=dict)


@dataclass
class AcmeEvent:
    id: str
    type: str
    data: dict
    created: int
    raw: dict = field(default_factory=dict)


class AcmePay:
    """Client for Acme Pay.

    Amounts are Decimals in major units (12.50 EUR); Acme takes integer minor
    units. Retries 429 and 5xx responses and connection errors with exponential
    backoff, reusing the same idempotency key on every attempt.
    """

    name = "acme"

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
        """Charge `amount` of `currency` to `source`. Returns an AcmeCharge."""
        amount = Decimal(amount)
        if amount <= 0:
            raise InvalidRequest("amount must be positive")
        if not supported(currency):
            raise InvalidRequest(f"unsupported currency {currency!r}")
        if not source:
            raise InvalidRequest("source is required")
        key = idempotency_key or self._new_key()
        body = {
            "amount": to_minor(amount, currency),
            "currency": currency.lower(),
            "source": source,
            "description": description,
            "metadata": metadata or {},
        }
        data = self._request("POST", "/v1/charges", body, key)
        return self._parse_charge(data, key)

    def refund(self, charge_id, amount=None, currency=None, idempotency_key=None):
        """Refund all of a charge, or `amount` of it. Returns an AcmeRefund."""
        if not charge_id:
            raise InvalidRequest("charge_id is required")
        body = {"charge": charge_id}
        if amount is not None:
            amount = Decimal(amount)
            if amount <= 0:
                raise InvalidRequest("refund amount must be positive")
            if not currency or not supported(currency):
                raise InvalidRequest("a supported currency is required with a partial refund")
            body["amount"] = to_minor(amount, currency)
        key = idempotency_key or self._new_key()
        data = self._request("POST", "/v1/refunds", body, key)
        return self._parse_refund(data, key)

    def get_charge(self, charge_id):
        """Fetch a charge by id. Returns an AcmeCharge."""
        if not charge_id:
            raise InvalidRequest("charge_id is required")
        data = self._request("GET", f"/v1/charges/{charge_id}", None)
        return self._parse_charge(data, data.get("idempotency_key", ""))

    def verify_webhook(self, payload, headers):
        """Check a webhook's signature and age, and return its AcmeEvent."""
        signature = headers.get("X-Acme-Webhook-Signature")
        timestamp = headers.get("X-Acme-Timestamp")
        if not signature or not timestamp:
            raise SignatureError("missing webhook signature headers")
        try:
            age = self.clock() - int(timestamp)
        except ValueError:
            raise SignatureError("bad webhook timestamp") from None
        if age > WEBHOOK_TOLERANCE_SECONDS:
            raise SignatureError("webhook is too old")
        expected = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise SignatureError("webhook signature does not match")
        try:
            data = json.loads(payload)
        except ValueError:
            raise SignatureError("webhook payload is not JSON") from None
        return AcmeEvent(
            id=data["id"],
            type=data["type"],
            data=data.get("data", {}),
            created=int(data.get("created", 0)),
            raw=data,
        )

    # --- internals --------------------------------------------------------------

    def _new_key(self):
        return "acme_" + uuid.uuid4().hex

    def _sign(self, body):
        return hmac.new(self.secret.encode(), body, hashlib.sha256).hexdigest()

    def _headers(self, method, path, body, key):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "X-Acme-Signature": self._sign(body),
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
                    raise ProviderUnavailable(f"acme: connection failed after {attempt + 1} attempts") from error
                if resp.status == 429:
                    raise RateLimited("acme: rate limited", status=429, code="rate_limited")
                raise ProviderUnavailable(f"acme: HTTP {resp.status} after {attempt + 1} attempts", status=resp.status)
            self.sleep(self.backoff * (2 ** attempt))
            attempt += 1

    def _decode(self, resp):
        try:
            return json.loads(resp.body or b"{}")
        except ValueError:
            raise ProviderUnavailable("acme: response is not JSON", status=resp.status) from None

    def _error(self, resp):
        try:
            err = json.loads(resp.body or b"{}").get("error", {})
        except ValueError:
            err = {}
        code = err.get("code", "")
        message = err.get("message") or f"HTTP {resp.status}"
        cls = ERROR_CODES.get(code, PaymentError)
        return cls(f"acme: {message}", status=resp.status, code=code)

    def _parse_charge(self, data, key):
        currency = data["currency"].upper()
        return AcmeCharge(
            id=data["id"],
            amount=from_minor(data["amount"], currency),
            currency=currency,
            status=STATUS_MAP.get(data.get("status"), "pending"),
            source=data.get("source", ""),
            idempotency_key=key,
            description=data.get("description", ""),
            metadata=data.get("metadata") or {},
            raw=data,
        )

    def _parse_refund(self, data, key):
        currency = data["currency"].upper()
        return AcmeRefund(
            id=data["id"],
            charge_id=data["charge"],
            amount=from_minor(data["amount"], currency),
            currency=currency,
            status=STATUS_MAP.get(data.get("status"), "pending"),
            idempotency_key=key,
            raw=data,
        )
