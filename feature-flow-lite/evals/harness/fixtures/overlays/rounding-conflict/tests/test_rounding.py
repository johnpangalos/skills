import unittest
from decimal import Decimal

from shop.money import to_cents


class RoundingPolicyTest(unittest.TestCase):
    # finance: half-cent amounts round up so invoices never under-charge
    def test_half_cent_rounds_up(self):
        self.assertEqual(to_cents(Decimal("1.005")), Decimal("1.01"))
        self.assertEqual(to_cents(Decimal("2.675")), Decimal("2.68"))

    # accounting: banker's rounding so long orders don't drift upward
    def test_bankers_rounding(self):
        self.assertEqual(to_cents(Decimal("1.015")), Decimal("1.02"))
        self.assertEqual(to_cents(Decimal("1.025")), Decimal("1.02"))
