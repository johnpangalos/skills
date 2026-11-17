"""Stress checks for risky-refunds: the cap and idempotency must hold under forced interleaving."""

import unittest
from decimal import Decimal

from _interleave import interleaved, race
from shop.cart import Cart
from shop.orders import Refund, RefundError, place_order, refund


def new_order():
    cart = Cart()
    cart.add("MUG")
    return place_order(cart)  # total 31.77


class StressTest(unittest.TestCase):
    def test_refunds_never_exceed_the_total(self):
        with interleaved("shop"):
            for trial in range(30):
                order = new_order()
                keys = iter(range(1000))
                results = race(lambda: refund(order, Decimal("10.00"), f"k{next(keys)}"), n=8)
                stray = [r for r in results if isinstance(r, Exception) and not isinstance(r, RefundError)]
                self.assertEqual(stray, [], f"trial {trial}: refund raised something other than RefundError")
                ok = [r for r in results if isinstance(r, Refund)]
                self.assertLessEqual(len(ok), 3, f"trial {trial}: {len(ok)} refunds of 10.00 on a 31.77 order")
                self.assertLessEqual(order.refunded(), order.total, f"trial {trial}: refunded more than the total")
                self.assertEqual(order.refunded(), Decimal("10.00") * len(ok), f"trial {trial}: refunded() disagrees with the refunds returned")

    def test_same_key_refunds_once(self):
        with interleaved("shop"):
            for trial in range(30):
                order = new_order()
                results = race(lambda: refund(order, Decimal("5.00"), "same"), n=8)
                stray = [r for r in results if isinstance(r, Exception)]
                self.assertEqual(stray, [], f"trial {trial}: a same-key replay raised {stray[:1]}")
                self.assertEqual(order.refunded(), Decimal("5.00"), f"trial {trial}: one key refunded {order.refunded()}")


if __name__ == "__main__":
    unittest.main()
