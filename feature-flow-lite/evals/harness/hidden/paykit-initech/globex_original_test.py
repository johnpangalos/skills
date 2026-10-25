import base64
import hashlib
import hmac
import json
import unittest
from decimal import Decimal

from paykit.errors import CardDeclined, InvalidRequest, PaymentError, ProviderUnavailable, RateLimited, SignatureError
from paykit.providers.globex import GlobexPay
from paykit.transport import FakeTransport, Response


def ok(body):
    return Response(200, json.dumps(body).encode())


def client(*responses, **kw):
    t = FakeTransport(*responses)
    c = GlobexPay("key_123", "s3cret", "whsec", t, sleep=lambda s: None, clock=lambda: 1_700_000_000, **kw)
    return c, t


CHARGE = {"paymentId": "pay_1", "amount": "12.50", "currency": "EUR", "state": "SUCCEEDED", "source": "tok_visa"}


class GlobexChargeTest(unittest.TestCase):
    def test_charge_sends_minor_units_and_parses(self):
        c, t = client(ok(CHARGE))
        ch = c.charge(Decimal("12.50"), "EUR", "tok_visa")
        self.assertEqual((ch.id, ch.amount, ch.currency, ch.status), ("pay_1", Decimal("12.50"), "EUR", "succeeded"))
        req = t.requests[0]
        self.assertEqual((req.method, req.url), ("POST", "https://pay.globex.example/api/payments"))
        self.assertEqual(json.loads(req.body)["amount"], "12.50")
        ts = req.headers["Globex-Timestamp"]
        digest = hmac.new(b"s3cret", ts.encode() + b"." + req.body, hashlib.sha512).digest()
        self.assertEqual(req.headers["Globex-Sig"], base64.b64encode(digest).decode())
        self.assertTrue(req.headers["Idempotency-Key"].startswith("gbx_"))

    def test_jpy_has_no_minor_units(self):
        c, t = client(ok({**CHARGE, "amount": "500", "currency": "JPY"}))
        ch = c.charge(Decimal("500"), "JPY", "tok_visa")
        self.assertEqual(json.loads(t.requests[0].body)["amount"], "500")
        self.assertEqual(ch.amount, Decimal("500"))

    def test_validation(self):
        c, _ = client()
        for args in ((Decimal("0"), "EUR", "tok"), (Decimal("5"), "XYZ", "tok"), (Decimal("5"), "EUR", "")):
            with self.assertRaises(InvalidRequest):
                c.charge(*args)

    def test_declined(self):
        c, _ = client(Response(402, b'{"code": "DECLINED", "detail": "insufficient funds"}'))
        with self.assertRaises(CardDeclined) as cm:
            c.charge(Decimal("5"), "EUR", "tok")
        self.assertEqual(cm.exception.status, 402)

    def test_unknown_error_code(self):
        c, _ = client(Response(400, b'{"code": "WEIRD"}'))
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
        self.assertEqual(c.get_charge("pay_1").id, "pay_1")
        self.assertEqual(t.requests[0].url, "https://pay.globex.example/api/payments/pay_1")


class GlobexRefundTest(unittest.TestCase):
    def test_full_refund(self):
        c, t = client(ok({"refundId": "rf_1", "paymentId": "pay_1", "amount": "12.50", "currency": "EUR", "state": "SUCCEEDED"}))
        r = c.refund("pay_1")
        self.assertEqual((r.id, r.charge_id, r.amount), ("rf_1", "pay_1", Decimal("12.50")))
        self.assertEqual(t.requests[0].url, "https://pay.globex.example/api/payments/pay_1/refunds")
        self.assertEqual(json.loads(t.requests[0].body), {})

    def test_partial_refund_needs_currency(self):
        c, t = client(ok({"refundId": "rf_2", "paymentId": "pay_1", "amount": "5.00", "currency": "EUR", "state": "PROCESSING"}))
        with self.assertRaises(InvalidRequest):
            c.refund("pay_1", Decimal("5"))
        r = c.refund("pay_1", Decimal("5"), "EUR")
        self.assertEqual(json.loads(t.requests[0].body)["amount"], "5.00")
        self.assertEqual(r.status, "pending")


class GlobexWebhookTest(unittest.TestCase):
    def signed(self, payload, ts=1_700_000_000):
        digest = hmac.new(b"whsec", str(ts).encode() + b"." + payload, hashlib.sha512).digest()
        return {"Globex-Webhook-Sig": base64.b64encode(digest).decode(), "Globex-Timestamp": str(ts)}

    def test_valid(self):
        c, _ = client()
        payload = b'{"eventId": "evt_1", "eventType": "PAYMENT.SUCCEEDED", "resource": {"paymentId": "pay_1"}, "timestamp": 1}'
        ev = c.verify_webhook(payload, self.signed(payload))
        self.assertEqual((ev.id, ev.type, ev.data["paymentId"]), ("evt_1", "PAYMENT.SUCCEEDED", "pay_1"))

    def test_bad_signature(self):
        c, _ = client()
        payload = b'{"eventId": "evt_1", "eventType": "x"}'
        headers = self.signed(payload)
        with self.assertRaises(SignatureError):
            c.verify_webhook(payload + b" ", headers)

    def test_too_old(self):
        c, _ = client()
        payload = b'{"eventId": "evt_1", "eventType": "x"}'
        with self.assertRaises(SignatureError):
            c.verify_webhook(payload, self.signed(payload, ts=1_700_000_000 - 301))
