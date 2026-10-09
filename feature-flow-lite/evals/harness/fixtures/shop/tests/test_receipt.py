import unittest

from shop.cart import Cart
from shop.receipt import render


class ReceiptTest(unittest.TestCase):
    def test_render(self):
        cart = Cart()
        cart.add("BEAN-COL", 2)
        lines = render(cart).splitlines()
        self.assertEqual(lines[0], "2 x Colombia Huila, 250 g" + "$32.00".rjust(15))
        self.assertTrue(lines[-1].startswith("Total"))
        self.assertTrue(lines[-1].endswith("$42.59"))
