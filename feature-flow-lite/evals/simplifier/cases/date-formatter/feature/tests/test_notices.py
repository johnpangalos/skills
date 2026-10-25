import unittest
from datetime import date

from shop.notices import invoice_header, reminder_text, shipping_label
from shop.orders import Order


def order(d):
    return Order(3, "Ada", "", 0.0, d)


class NoticesTest(unittest.TestCase):
    def test_suffixes(self):
        self.assertEqual(invoice_header(order(date(2026, 3, 1))), "Invoice #3 - due 1st March 2026")
        self.assertEqual(invoice_header(order(date(2026, 3, 12))), "Invoice #3 - due 12th March 2026")
        self.assertEqual(invoice_header(order(date(2026, 3, 23))), "Invoice #3 - due 23rd March 2026")

    def test_label_is_upper(self):
        self.assertEqual(shipping_label(order(date(2026, 3, 2))), "SHIP TO ADA BY 2ND MARCH 2026")

    def test_overdue_reminder(self):
        self.assertIn("was due on the 11th", reminder_text(order(date(2026, 3, 11)), 0))
