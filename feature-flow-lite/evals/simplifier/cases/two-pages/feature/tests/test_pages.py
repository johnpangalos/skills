import unittest
from datetime import date

from shop.orders import Line, Order
from shop.pages import render_invoice_page, render_receipt_page

ORDER = Order(7, "Ada", "GB123", 0.2, date(2026, 3, 1), [Line("Pen", 2, 150), Line("Ink", 1, 1299)])


class PagesTest(unittest.TestCase):
    def test_invoice_has_tax_id_and_amount_due(self):
        page = render_invoice_page(ORDER)
        self.assertIn("Tax ID: GB123", page)
        self.assertIn("Amount due: $19.19", page)

    def test_receipt_thanks_customer(self):
        page = render_receipt_page(ORDER)
        self.assertIn("Thanks, Ada!", page)
        self.assertIn("Paid: $19.19", page)
        self.assertNotIn("Tax ID", page)
