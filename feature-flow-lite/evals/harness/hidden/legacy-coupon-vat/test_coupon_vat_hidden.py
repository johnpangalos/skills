"""Hidden checks: EU coupon VAT is counted once, on every path that prices an order."""

import unittest

from ledgerline.api.quote import quote_json
from ledgerline.exports.ledger import ledger_rows
from ledgerline.invoicing.build import build_invoice
from ledgerline.orders.model import Order
from ledgerline.pricing.pipeline import price


def de_save10():
    return Order("DE", [("BK-1", 5000, 1)], coupon="SAVE10", reference="ORD-42")


class CouponVatHiddenTest(unittest.TestCase):
    def test_reported_case_pipeline(self):
        q = price(de_save10())
        self.assertEqual((q.subtotal, q.discount, q.tax, q.shipping, q.total), (5000, 500, 855, 0, 5355))

    def test_reported_case_invoice(self):
        inv = build_invoice(de_save10())
        self.assertIn("VAT 19%: €8.55", inv.text)
        self.assertIn("Total: €53.55", inv.text)

    def test_ledger_export(self):
        [row] = ledger_rows([de_save10()])
        self.assertEqual((row["net"], row["tax"], row["gross"]), (4500, 855, 5355))

    def test_storefront_quote(self):
        self.assertEqual(quote_json(de_save10())["tax"], 855)

    def test_fixed_coupon_france_with_shipping(self):
        q = price(Order("FR", [("BK-2", 3000, 1)], coupon="WELCOME5"))
        self.assertEqual((q.discount, q.tax, q.shipping, q.total), (500, 500, 495, 3495))

    def test_eu_half_even_rounding_still_applies_with_coupon(self):
        q = price(Order("DE", [("BK-3", 2850, 1)], coupon="WELCOME5"))  # net 2350 -> 446.5 VAT
        self.assertEqual(q.tax, 446)

    def test_eu_half_even_rounding_without_coupon(self):
        self.assertEqual(price(Order("DE", [("BK-4", 2350, 1)])).tax, 446)

    def test_netherlands_percent_coupon(self):
        q = price(Order("NL", [("BK-5", 8000, 1)], coupon="SAVE25"))
        self.assertEqual((q.discount, q.tax, q.total), (2000, 1260, 7260))

    def test_japan_and_us_unchanged(self):
        self.assertEqual(price(Order("JP", [("BK-6", 1995, 1)], coupon="SAVE10")).tax, 179)
        self.assertEqual(price(Order("US", [("BK-7", 6000, 1)], coupon="SAVE10")).total, 5400)
