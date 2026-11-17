"""Answer-key probes for discount-codes (probes/keys.json). Each test name is test_<key id with _>;
it fails when that keyed bug is present. Run from the build dir so shop/ is importable."""
import unittest

from shop.cart import Cart
from shop.discounts import InvalidCode
from shop.receipt import render


class Probes(unittest.TestCase):
    def test_unicode_lookalike(self):
        # str.upper() maps U+017F to S and U+FB00 to FF; NFKC maps fullwidth letters to ASCII
        for code in ["\u017fave10", "FIVEO\ufb00", "\uff33\uff21\uff36\uff25\uff11\uff10"]:
            with self.subTest(code=code):
                cart = Cart()
                cart.add("MUG")
                with self.assertRaises(InvalidCode):
                    cart.apply_code(code)
                self.assertEqual(cart.discount(), 0)

    def test_negative_zero(self):
        for code in ["SAVE10", "FIVEOFF"]:
            with self.subTest(code=code):
                cart = Cart()
                cart.apply_code(code)
                self.assertNotIn("-$0.00", render(cart))


if __name__ == "__main__":
    unittest.main()
