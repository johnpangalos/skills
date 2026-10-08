import unittest
from decimal import Decimal

from shop.cart import Cart
from shop.discounts import InvalidCode
from shop.receipt import render


def cart_of(*pairs):
    cart = Cart()
    for sku, qty in pairs:
        cart.add(sku, qty)
    return cart


class DiscountTest(unittest.TestCase):
    def test_save10_before_tax(self):
        cart = cart_of(("BEAN-ETH", 2), ("FILTER", 1))
        cart.apply_code("SAVE10")
        self.assertEqual(cart.discount(), Decimal("4.33"))
        self.assertEqual(cart.tax(), Decimal("3.21"))
        self.assertEqual(cart.shipping(), Decimal("7.95"))
        self.assertEqual(cart.total(), Decimal("50.08"))

    def test_codes_are_case_insensitive(self):
        cart = cart_of(("BEAN-ETH", 2), ("FILTER", 1))
        cart.apply_code("save10")
        self.assertEqual(cart.discount(), Decimal("4.33"))

    def test_no_code_means_no_discount(self):
        cart = cart_of(("MUG", 1))
        self.assertEqual(cart.discount(), Decimal("0.00"))
        self.assertEqual(cart.total(), Decimal("31.77"))

    def test_fiveoff(self):
        cart = cart_of(("FILTER", 1))
        cart.apply_code("FIVEOFF")
        self.assertEqual(cart.discount(), Decimal("5.00"))
        self.assertEqual(cart.tax(), Decimal("0.10"))
        self.assertEqual(cart.total(), Decimal("9.30"))

    def test_discount_never_exceeds_subtotal(self):
        cart = Cart()
        cart.apply_code("FIVEOFF")
        self.assertEqual(cart.discount(), Decimal("0.00"))
        self.assertEqual(cart.total(), Decimal("0.00"))

    def test_free_shipping_uses_pre_discount_subtotal(self):
        cart = cart_of(("MUG", 2), ("BEAN-ETH", 1), ("FILTER", 2))
        cart.apply_code("SAVE10")
        self.assertEqual(cart.discount(), Decimal("7.50"))
        self.assertEqual(cart.shipping(), Decimal("0.00"))
        self.assertEqual(cart.total(), Decimal("73.07"))

    def test_new_code_replaces_old(self):
        cart = cart_of(("BEAN-ETH", 2), ("FILTER", 1))
        cart.apply_code("SAVE10")
        cart.apply_code("FIVEOFF")
        self.assertEqual(cart.discount(), Decimal("5.00"))

    def test_unknown_code_keeps_current(self):
        cart = cart_of(("BEAN-ETH", 2), ("FILTER", 1))
        cart.apply_code("SAVE10")
        with self.assertRaises(InvalidCode):
            cart.apply_code("BOGUS")
        self.assertEqual(cart.discount(), Decimal("4.33"))


class DiscountReceiptTest(unittest.TestCase):
    def test_discount_line_between_subtotal_and_shipping(self):
        cart = cart_of(("BEAN-ETH", 2), ("FILTER", 1))
        cart.apply_code("save10")
        lines = render(cart).splitlines()
        labels = [line.split("  ")[0].strip() for line in lines]
        sub = next(i for i, line in enumerate(lines) if line.startswith("Subtotal"))
        disc = next(i for i, line in enumerate(lines) if line.startswith("Discount (SAVE10)"))
        ship = next(i for i, line in enumerate(lines) if line.startswith("Shipping"))
        self.assertTrue(sub < disc < ship, labels)
        self.assertTrue(lines[disc].rstrip().endswith("-$4.33"), lines[disc])
        self.assertTrue(lines[-1].rstrip().endswith("$50.08"), lines[-1])

    def test_no_discount_line_without_code(self):
        cart = cart_of(("MUG", 1))
        self.assertFalse(any(line.startswith("Discount") for line in render(cart).splitlines()))
