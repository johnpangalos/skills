import unittest
from decimal import Decimal

from shop.money import format_money


class NegativeMoneyTest(unittest.TestCase):
    def test_negative_sign_before_dollar(self):
        self.assertEqual(format_money(Decimal("-5")), "-$5.00")
        self.assertEqual(format_money(Decimal("-1234.5")), "-$1,234.50")

    def test_positive_unchanged(self):
        self.assertEqual(format_money(Decimal("12")), "$12.00")
        self.assertEqual(format_money(Decimal("1234.5")), "$1,234.50")
