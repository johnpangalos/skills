import unittest
from datetime import date

from shop.discounts import apply_discount
from shop.orders import Line, Order

ORDER = Order(1, "Ada", "", 0.0, date(2026, 1, 1), [Line("Pen", 3, 333)])


class DiscountTest(unittest.TestCase):
    def test_ten_percent(self):
        self.assertEqual(apply_discount(ORDER, 10), 899)

    def test_out_of_range(self):
        with self.assertRaises(ValueError):
            apply_discount(ORDER, 101)
