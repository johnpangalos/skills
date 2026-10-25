import unittest
from datetime import date

from shop.emails import order_confirmed_page, order_shipped_page
from shop.orders import Line, Order

ORDER = Order(7, "Ada", "", 0.0, date(2026, 3, 1), [Line("Pen", 2, 150)])


class EmailsTest(unittest.TestCase):
    def test_confirmed(self):
        self.assertIn("We've received order #7", order_confirmed_page(ORDER))

    def test_shipped(self):
        page = order_shipped_page(ORDER)
        self.assertIn("arrive by 2026-03-01", page)
        self.assertIn("<li>2 x Pen</li>", page)
