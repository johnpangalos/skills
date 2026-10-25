import unittest

from shop import api


class ApiTest(unittest.TestCase):
    def setUp(self):
        api.USERS.clear(); api.PRODUCTS.clear()

    def test_create_user(self):
        self.assertEqual(api.create_user({"email": "A@x.io", "name": " Ada "}),
                         {"id": 1, "email": "a@x.io", "name": "Ada"})

    def test_user_missing_name(self):
        with self.assertRaisesRegex(api.ValidationError, "missing field: name"):
            api.create_user({"email": "a@x.io"})

    def test_create_product(self):
        self.assertEqual(api.create_product({"sku": "pen-1", "name": "Pen", "price_cents": 150})["sku"], "PEN-1")

    def test_negative_price(self):
        with self.assertRaises(api.ValidationError):
            api.create_product({"sku": "x", "name": "X", "price_cents": -1})
