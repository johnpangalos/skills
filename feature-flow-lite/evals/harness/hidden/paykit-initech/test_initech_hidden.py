"""Hidden behavior tests for the Initech Pay provider."""

import base64
import hashlib
import hmac
import json
import unittest
from decimal import Decimal

from paykit.errors import CardDeclined, InvalidRequest, PaymentError, ProviderUnavailable, RateLimited, SignatureError
from paykit.providers.initech import InitechPay
from paykit.registry import get_provider
from paykit.transport import FakeTransport, Response

NOW = 1_700_000_000


def ok(body):
    return Response(200, json.dumps(body).encode())


def client(*responses, **kw):
    t = FakeTransport(*responses)
    c = InitechPay("key_9", "s3cret", "whsec", t, sleep=lambda s: None, clock=lambda: NOW, **kw)
    return c, t


CHARGE = {"charge_id": "chg_1", "amount": 1250, "currency": "EUR", "state": "captured", "source": "tok_visa"}


def auth_header(method, path, body):
    digest = hmac.new(b"s3cret", f"{method}\n{path}\n".encode() + body, hashlib.sha256).digest()
    return "key_9:" + base64.b64encode(digest).decode()


class InitechChargeHidden(unittest.TestCase):
    def test_charge_request_and_parse(self):
        c, t = client(ok(CHARGE))
        ch = c.charge(Decimal("12.50"), "eur", "tok_visa")
        self.assertEqual((ch.id, ch.amount, ch.currency, ch.status, ch.source), ("chg_1", Decimal("12.50"), "EUR", "succeeded", "tok_visa"))
        req = t.requests[0]
        self.assertEqual((req.method, req.url), ("POST", "https://api.initech.example/charges"))
        body = json.loads(req.body)
        self.assertEqual((body["amount"], body["currency"], body["source"]), (1250, "EUR", "tok_visa"))
        self.assertEqual(req.headers["Initech-Auth"], auth_header("POST", "/charges", req.body))
        self.assertTrue(req.headers["Idempotency-Key"].startswith("itc_"))
        self.assertEqual(ch.idempotency_key, req.headers["Idempotency-Key"])

    def test_states(self):
        for state, status in (("failed", "failed"), ("pending", "pending"), ("captured", "succeeded")):
            c, _ = client(ok({**CHARGE, "state": state}))
            self.assertEqual(c.charge(Decimal("1"), "EUR", "tok").status, status)

    def test_minor_units_by_currency(self):
        c, t = client(ok({**CHARGE, "amount": 500, "currency": "JPY"}), ok({**CHARGE, "amount": 1235, "currency": "KWD"}))
        self.assertEqual(c.charge(Decimal("500"), "JPY", "tok").amount, Decimal("500"))
        self.assertEqual(json.loads(t.requests[0].body)["amount"], 500)
        c.charge(Decimal("1.2345"), "KWD", "tok")
        self.assertEqual(json.loads(t.requests[1].body)["amount"], 1235)

    def test_validation(self):
        c, t = client()
        for args in ((Decimal("0"), "EUR", "tok"), (Decimal("-1"), "EUR", "tok"), (Decimal("5"), "XYZ", "tok"), (Decimal("5"), "EUR", "")):
            with self.assertRaises(InvalidRequest):
                c.charge(*args)
        self.assertEqual(t.requests, [])

    def test_error_codes(self):
        cases = [(402, "E_DECLINED", CardDeclined), (400, "E_INVALID", InvalidRequest), (409, "E_OTHER", PaymentError)]
        for status, code, cls in cases:
            c, _ = client(Response(status, json.dumps({"error_code": code, "error_message": "nope"}).encode()))
            with self.assertRaises(cls) as cm:
                c.charge(Decimal("5"), "EUR", "tok")
            self.assertEqual((cm.exception.status, cm.exception.code), (status, code))

    def test_rate_limit_code_maps(self):
        c, _ = client(Response(400, b'{"error_code": "E_RATE", "error_message": "slow down"}'))
        with self.assertRaises(RateLimited):
            c.charge(Decimal("5"), "EUR", "tok")

    def test_retries_keep_idempotency_key(self):
        c, t = client(Response(429), Response(502), ConnectionError("reset"), ok(CHARGE))
        c.charge(Decimal("12.50"), "EUR", "tok_visa")
        keys = {r.headers["Idempotency-Key"] for r in t.requests}
        self.assertEqual((len(t.requests), len(keys)), (4, 1))

    def test_backoff_doubles(self):
        waits = []
        t = FakeTransport(Response(500), Response(500), Response(500), ok(CHARGE))
        c = InitechPay("key_9", "s3cret", "whsec", t, sleep=waits.append, clock=lambda: NOW)
        c.charge(Decimal("1"), "EUR", "tok")
        self.assertEqual(waits, [0.5, 1.0, 2.0])

    def test_gives_up(self):
        c, t = client(*[Response(503)] * 4)
        with self.assertRaises(ProviderUnavailable):
            c.charge(Decimal("5"), "EUR", "tok")
        self.assertEqual(len(t.requests), 4)
        c, _ = client(*[Response(429)] * 4)
        with self.assertRaises(RateLimited):
            c.charge(Decimal("5"), "EUR", "tok")

    def test_get_charge(self):
        c, t = client(ok(CHARGE))
        self.assertEqual(c.get_charge("chg_1").id, "chg_1")
        req = t.requests[0]
        self.assertEqual((req.method, req.url), ("GET", "https://api.initech.example/charges/chg_1"))
        self.assertEqual(req.headers["Initech-Auth"], auth_header("GET", "/charges/chg_1", req.body))


class InitechRefundHidden(unittest.TestCase):
    def test_full_refund(self):
        c, t = client(ok({"refund_id": "rf_1", "charge_id": "chg_1", "amount": 1250, "currency": "EUR", "state": "captured"}))
        r = c.refund("chg_1")
        self.assertEqual((r.id, r.charge_id, r.amount, r.status), ("rf_1", "chg_1", Decimal("12.50"), "succeeded"))
        req = t.requests[0]
        self.assertEqual(req.url, "https://api.initech.example/charges/chg_1/refunds")
        self.assertNotIn("amount", json.loads(req.body or b"{}"))
        self.assertIn("Idempotency-Key", req.headers)

    def test_partial_refund(self):
        c, t = client(ok({"refund_id": "rf_2", "charge_id": "chg_1", "amount": 500, "currency": "EUR", "state": "pending"}))
        with self.assertRaises(InvalidRequest):
            c.refund("chg_1", Decimal("5"))
        r = c.refund("chg_1", Decimal("5"), "EUR")
        self.assertEqual(json.loads(t.requests[0].body)["amount"], 500)
        self.assertEqual(r.status, "pending")


class InitechWebhookHidden(unittest.TestCase):
    PAYLOAD = b'{"event_id": "ev_1", "event_type": "charge.captured", "payload": {"charge_id": "chg_1"}, "created_at": 1699999999}'

    def headers(self, payload, ts=NOW):
        return {"Initech-Webhook-Signature": hmac.new(b"whsec", payload, hashlib.sha256).hexdigest(), "Initech-Timestamp": str(ts)}

    def test_valid(self):
        c, _ = client()
        ev = c.verify_webhook(self.PAYLOAD, self.headers(self.PAYLOAD))
        self.assertEqual((ev.id, ev.type, ev.data, ev.created), ("ev_1", "charge.captured", {"charge_id": "chg_1"}, 1699999999))

    def test_rejects(self):
        c, _ = client()
        bad = [
            (self.PAYLOAD + b" ", self.headers(self.PAYLOAD)),
            (self.PAYLOAD, self.headers(self.PAYLOAD, ts=NOW - 301)),
            (self.PAYLOAD, {"Initech-Timestamp": str(NOW)}),
            (self.PAYLOAD, {**self.headers(self.PAYLOAD), "Initech-Timestamp": "soon"}),
        ]
        for payload, headers in bad:
            with self.assertRaises(SignatureError):
                c.verify_webhook(payload, headers)


class RegistryHidden(unittest.TestCase):
    def test_registered(self):
        p = get_provider("initech", api_key="k", secret="s", webhook_secret="w", transport=FakeTransport())
        self.assertIsInstance(p, InitechPay)
        self.assertEqual(p.name, "initech")
        for name in ("acme", "globex"):
            self.assertEqual(get_provider(name, api_key="k", secret="s", webhook_secret="w", transport=FakeTransport()).name, name)
