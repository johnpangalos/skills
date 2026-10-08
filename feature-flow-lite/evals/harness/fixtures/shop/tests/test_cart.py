import unittest
from decimal import Decimal

from shop.cart import Cart
from shop.catalog import UnknownProduct


class CartTest(unittest.TestCase):
    def test_totals(self):
        cart = Cart()
        cart.add("BEAN-ETH", 2)
        cart.add("FILTER")
        self.assertEqual(cart.subtotal(), Decimal("43.25"))
        self.assertEqual(cart.shipping(), Decimal("7.95"))
        self.assertEqual(cart.tax(), Decimal("3.57"))
        self.assertEqual(cart.total(), Decimal("54.77"))

    def test_free_shipping_at_threshold(self):
        cart = Cart()
        cart.add("MUG", 2)
        cart.add("BEAN-ETH")
        cart.add("FILTER", 2)
        self.assertEqual(cart.subtotal(), Decimal("75.00"))
        self.assertEqual(cart.shipping(), Decimal("0.00"))

    def test_empty_cart_is_free(self):
        self.assertEqual(Cart().total(), Decimal("0.00"))

    def test_unknown_sku(self):
        with self.assertRaises(UnknownProduct):
            Cart().add("NOPE")
