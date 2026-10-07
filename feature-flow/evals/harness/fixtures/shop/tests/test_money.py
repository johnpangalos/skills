import unittest
from decimal import Decimal

from shop.money import format_money, to_cents


class MoneyTest(unittest.TestCase):
    def test_to_cents_rounds_half_up(self):
        self.assertEqual(to_cents(Decimal("2.345")), Decimal("2.35"))

    def test_format_money(self):
        self.assertEqual(format_money(Decimal("1234.5")), "$1,234.50")
        self.assertEqual(format_money(Decimal("0")), "$0.00")
