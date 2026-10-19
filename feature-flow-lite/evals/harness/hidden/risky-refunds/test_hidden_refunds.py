"""Hidden checks for risky-refunds: the spec, plus the edges a careless build gets wrong."""

import unittest
from decimal import Decimal

from shop.cart import Cart
from shop.orders import RefundError, place_order, refund


def order_for(*skus):
    cart = Cart()
    for sku in skus:
        cart.add(sku)
    return place_order(cart)


class SpecTest(unittest.TestCase):
    def test_order_total_and_ids(self):
        a, b = order_for("MUG"), order_for("MUG")
        self.assertEqual(a.total, Decimal("31.77"))  # 22.00 + 7.95 shipping + 1.82 tax
        self.assertNotEqual(a.id, b.id)
        self.assertEqual(a.refunded(), Decimal("0"))
        self.assertEqual(a.refundable(), a.total)

    def test_empty_cart_cannot_be_ordered(self):
        with self.assertRaises(ValueError):
            place_order(Cart())

    def test_partial_refunds_add_up(self):
        order = order_for("MUG")
        r = refund(order, Decimal("10.00"), "k1")
        refund(order, Decimal("5.50"), "k2")
        self.assertEqual(order.refunded(), Decimal("15.50"))
        self.assertEqual(order.refundable(), Decimal("16.27"))
        self.assertEqual((r.order_id, r.amount, r.key), (order.id, Decimal("10.00"), "k1"))

    def test_over_refund_raises_and_changes_nothing(self):
        order = order_for("MUG")
        refund(order, Decimal("30.00"), "k1")
        with self.assertRaises(RefundError):
            refund(order, Decimal("1.78"), "k2")
        self.assertEqual(order.refunded(), Decimal("30.00"))

    def test_idempotent_replay(self):
        order = order_for("MUG")
        first = refund(order, Decimal("10.00"), "k1")
        again = refund(order, Decimal("10.00"), "k1")
        self.assertEqual((again.order_id, again.amount, again.key), (first.order_id, first.amount, first.key))
        self.assertEqual(order.refunded(), Decimal("10.00"))

    def test_key_reuse_with_other_amount(self):
        order = order_for("MUG")
        refund(order, Decimal("10.00"), "k1")
        with self.assertRaises(RefundError):
            refund(order, Decimal("11.00"), "k1")
        self.assertEqual(order.refunded(), Decimal("10.00"))


class EdgeTest(unittest.TestCase):
    def test_full_refund_to_the_cent(self):
        order = order_for("MUG")
        refund(order, order.total, "all")
        self.assertEqual(order.refundable(), Decimal("0"))
        with self.assertRaises(RefundError):
            refund(order, Decimal("0.01"), "more")

    def test_non_positive_amounts(self):
        order = order_for("MUG")
        for bad in (Decimal("0"), Decimal("0.00"), Decimal("-0.00"), Decimal("-1.00")):
            with self.assertRaises(RefundError, msg=repr(bad)):
                refund(order, bad, f"k{bad}")
        self.assertEqual(order.refunded(), Decimal("0"))

    def test_sub_cent_amounts(self):
        order = order_for("MUG")
        for bad in (Decimal("0.001"), Decimal("1.005"), Decimal("0.009")):
            with self.assertRaises(RefundError, msg=repr(bad)):
                refund(order, bad, f"k{bad}")
        self.assertEqual(order.refunded(), Decimal("0"))

    def test_whole_cent_spellings_are_accepted(self):
        order = order_for("MUG")
        refund(order, Decimal("1.5"), "a")
        refund(order, Decimal("1.500"), "b")
        refund(order, Decimal("1E+1"), "c")
        self.assertEqual(order.refunded(), Decimal("13.00"))

    def test_non_decimal_amounts(self):
        order = order_for("MUG")
        for bad in (1.5, 5, "5.00", True, None):
            with self.assertRaises(RefundError, msg=repr(bad)):
                refund(order, bad, f"k{bad!r}")
        self.assertEqual(order.refunded(), Decimal("0"))

    def test_special_decimals(self):
        # NaN and sNaN make ordinary comparisons raise InvalidOperation (an ArithmeticError)
        order = order_for("MUG")
        for bad in (Decimal("NaN"), Decimal("sNaN"), Decimal("Infinity"), Decimal("-Infinity")):
            with self.assertRaises(RefundError, msg=repr(bad)):
                refund(order, bad, f"k{bad}")
        self.assertEqual(order.refunded(), Decimal("0"))

    def test_replay_after_order_is_fully_refunded(self):
        order = order_for("MUG")
        first = refund(order, order.total, "all")
        again = refund(order, order.total, "all")
        self.assertEqual(again.amount, first.amount)
        self.assertEqual(order.refunded(), order.total)

    def test_replay_with_an_equal_amount_spelled_differently(self):
        order = order_for("MUG")
        refund(order, Decimal("5.00"), "k1")
        again = refund(order, Decimal("5"), "k1")
        self.assertEqual(again.amount, Decimal("5.00"))
        self.assertEqual(order.refunded(), Decimal("5.00"))

    def test_failed_refund_does_not_burn_its_key(self):
        order = order_for("MUG")
        with self.assertRaises(RefundError):
            refund(order, Decimal("100.00"), "k1")
        refund(order, Decimal("10.00"), "k1")
        self.assertEqual(order.refunded(), Decimal("10.00"))

    def test_keys_are_scoped_to_their_order(self):
        a, b = order_for("MUG"), order_for("MUG")
        refund(a, Decimal("10.00"), "same")
        refund(b, Decimal("12.00"), "same")
        self.assertEqual((a.refunded(), b.refunded()), (Decimal("10.00"), Decimal("12.00")))

    def test_total_is_fixed_when_placed(self):
        cart = Cart()
        cart.add("MUG")
        order = place_order(cart)
        cart.add("MUG", 5)
        self.assertEqual(order.total, Decimal("31.77"))
        with self.assertRaises(RefundError):
            refund(order, Decimal("40.00"), "k")


if __name__ == "__main__":
    unittest.main()
