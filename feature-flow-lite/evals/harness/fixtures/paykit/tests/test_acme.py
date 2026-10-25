import hashlib
import hmac
import json
import unittest
from decimal import Decimal

from paykit.errors import CardDeclined, InvalidRequest, PaymentError, ProviderUnavailable, RateLimited, SignatureError
from paykit.providers.acme import AcmePay
from paykit.transport import FakeTransport, Response


def ok(body):
    return Response(200, json.dumps(body).encode())


def client(*responses, **kw):
    t = FakeTransport(*responses)
    c = AcmePay("key_123", "s3cret", "whsec", t, sleep=lambda s: None, clock=lambda: 1_700_000_000, **kw)
    return c, t


CHARGE = {"id": "ch_1", "amount": 1250, "currency": "eur", "status": "succeeded", "source": "tok_visa"}


class AcmeChargeTest(unittest.TestCase):
    def test_charge_sends_minor_units_and_parses(self):
        c, t = client(ok(CHARGE))
        ch = c.charge(Decimal("12.50"), "EUR", "tok_visa")
        self.assertEqual((ch.id, ch.amount, ch.currency, ch.status), ("ch_1", Decimal("12.50"), "EUR", "succeeded"))
        req = t.requests[0]
        self.assertEqual((req.method, req.url), ("POST", "https://api.acmepay.example/v1/charges"))
        self.assertEqual(json.loads(req.body)["amount"], 1250)
        self.assertEqual(req.headers["X-Acme-Signature"], hmac.new(b"s3cret", req.body, hashlib.sha256).hexdigest())
        self.assertTrue(req.headers["Idempotency-Key"].startswith("acme_"))

    def test_jpy_has_no_minor_units(self):
        c, t = client(ok({**CHARGE, "amount": 500, "currency": "jpy"}))
        ch = c.charge(Decimal("500"), "JPY", "tok_visa")
        self.assertEqual(json.loads(t.requests[0].body)["amount"], 500)
        self.assertEqual(ch.amount, Decimal("500"))

    def test_validation(self):
        c, _ = client()
        for args in ((Decimal("0"), "EUR", "tok"), (Decimal("5"), "XYZ", "tok"), (Decimal("5"), "EUR", "")):
            with self.assertRaises(InvalidRequest):
                c.charge(*args)

    def test_declined(self):
        c, _ = client(Response(402, b'{"error": {"code": "card_declined", "message": "insufficient funds"}}'))
        with self.assertRaises(CardDeclined) as cm:
            c.charge(Decimal("5"), "EUR", "tok")
        self.assertEqual(cm.exception.status, 402)

    def test_unknown_error_code(self):
        c, _ = client(Response(400, b'{"error": {"code": "weird"}}'))
        with self.assertRaises(PaymentError):
            c.charge(Decimal("5"), "EUR", "tok")

    def test_retries_with_same_key(self):
        c, t = client(Response(429), Response(503), ok(CHARGE))
        c.charge(Decimal("12.50"), "EUR", "tok_visa", idempotency_key="k1")
        self.assertEqual([r.headers["Idempotency-Key"] for r in t.requests], ["k1"] * 3)

    def test_gives_up_after_max_retries(self):
        c, t = client(*[Response(500)] * 4)
        with self.assertRaises(ProviderUnavailable):
            c.charge(Decimal("5"), "EUR", "tok")
        self.assertEqual(len(t.requests), 4)

    def test_rate_limited_after_retries(self):
        c, _ = client(*[Response(429)] * 4)
        with self.assertRaises(RateLimited):
            c.charge(Decimal("5"), "EUR", "tok")

    def test_connection_errors_retry(self):
        c, t = client(ConnectionError("reset"), ok(CHARGE))
        c.charge(Decimal("12.50"), "EUR", "tok_visa")
        self.assertEqual(len(t.requests), 2)

    def test_get_charge(self):
        c, t = client(ok(CHARGE))
        self.assertEqual(c.get_charge("ch_1").id, "ch_1")
        self.assertEqual(t.requests[0].url, "https://api.acmepay.example/v1/charges/ch_1")


class AcmeRefundTest(unittest.TestCase):
    def test_full_refund(self):
        c, t = client(ok({"id": "re_1", "charge": "ch_1", "amount": 1250, "currency": "eur", "status": "succeeded"}))
        r = c.refund("ch_1")
        self.assertEqual((r.id, r.charge_id, r.amount), ("re_1", "ch_1", Decimal("12.50")))
        self.assertEqual(json.loads(t.requests[0].body), {"charge": "ch_1"})

    def test_partial_refund_needs_currency(self):
        c, t = client(ok({"id": "re_2", "charge": "ch_1", "amount": 500, "currency": "eur", "status": "pending"}))
        with self.assertRaises(InvalidRequest):
            c.refund("ch_1", Decimal("5"))
        r = c.refund("ch_1", Decimal("5"), "EUR")
        self.assertEqual(json.loads(t.requests[0].body)["amount"], 500)
        self.assertEqual(r.status, "pending")


class AcmeWebhookTest(unittest.TestCase):
    def signed(self, payload, ts=1_700_000_000):
        sig = hmac.new(b"whsec", payload, hashlib.sha256).hexdigest()
        return {"X-Acme-Webhook-Signature": sig, "X-Acme-Timestamp": str(ts)}

    def test_valid(self):
        c, _ = client()
        payload = b'{"id": "evt_1", "type": "charge.succeeded", "data": {"id": "ch_1"}, "created": 1}'
        ev = c.verify_webhook(payload, self.signed(payload))
        self.assertEqual((ev.id, ev.type, ev.data["id"]), ("evt_1", "charge.succeeded", "ch_1"))

    def test_bad_signature(self):
        c, _ = client()
        payload = b'{"id": "evt_1", "type": "x"}'
        headers = self.signed(payload)
        with self.assertRaises(SignatureError):
            c.verify_webhook(payload + b" ", headers)

    def test_too_old(self):
        c, _ = client()
        payload = b'{"id": "evt_1", "type": "x"}'
        with self.assertRaises(SignatureError):
            c.verify_webhook(payload, self.signed(payload, ts=1_700_000_000 - 301))
