import unittest
from decimal import Decimal

from paykit.money import from_minor, to_decimal_string, to_minor


class MoneyTest(unittest.TestCase):
    def test_to_minor(self):
        self.assertEqual(to_minor(Decimal("12.345"), "EUR"), 1235)
        self.assertEqual(to_minor(Decimal("500"), "JPY"), 500)
        self.assertEqual(to_minor(Decimal("1.2345"), "KWD"), 1235)

    def test_from_minor(self):
        self.assertEqual(from_minor(1250, "EUR"), Decimal("12.50"))

    def test_decimal_string(self):
        self.assertEqual(to_decimal_string(Decimal("5"), "EUR"), "5.00")
