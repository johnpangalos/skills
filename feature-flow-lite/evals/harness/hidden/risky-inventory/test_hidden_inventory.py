"""Hidden checks for risky-inventory: the spec, plus the edges a careless build gets wrong."""

import sys
import threading
import unittest

from shop.catalog import UnknownProduct
from shop.inventory import Inventory, OutOfStock, ReservationError


def race(n, fn):
    """Run fn() on n threads released together; return how many returned without raising."""
    barrier = threading.Barrier(n)
    wins = []

    def go():
        barrier.wait()
        try:
            fn()
            wins.append(1)
        except ValueError:
            pass

    threads = [threading.Thread(target=go) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return len(wins)


class SpecTest(unittest.TestCase):
    def test_reserve_commit_release(self):
        inv = Inventory({"MUG": 5})
        r = inv.reserve("MUG", 2)
        self.assertEqual(inv.available("MUG"), 3)
        inv.commit(r)
        self.assertEqual(inv.available("MUG"), 3)
        r2 = inv.reserve("MUG", 3)
        inv.release(r2)
        self.assertEqual(inv.available("MUG"), 3)

    def test_out_of_stock(self):
        inv = Inventory({"MUG": 1})
        with self.assertRaises(OutOfStock):
            inv.reserve("MUG", 2)
        self.assertTrue(issubclass(OutOfStock, ValueError))
        self.assertTrue(issubclass(ReservationError, ValueError))

    def test_unknown_and_missing_skus(self):
        inv = Inventory({"MUG": 1})
        with self.assertRaises(UnknownProduct):
            inv.available("NOPE")
        with self.assertRaises(UnknownProduct):
            inv.reserve("NOPE", 1)
        self.assertEqual(inv.available("FILTER"), 0)
        with self.assertRaises(OutOfStock):
            inv.reserve("FILTER", 1)

    def test_settled_twice(self):
        inv = Inventory({"MUG": 5})
        r = inv.reserve("MUG", 1)
        inv.commit(r)
        for settle in (inv.commit, inv.release):
            with self.assertRaises(ReservationError):
                settle(r)
        r = inv.reserve("MUG", 1)
        inv.release(r)
        for settle in (inv.commit, inv.release):
            with self.assertRaises(ReservationError):
                settle(r)

    def test_bad_qty(self):
        inv = Inventory({"MUG": 5})
        for bad in (0, -1):
            with self.assertRaises(ValueError):
                inv.reserve("MUG", bad)


class EdgeTest(unittest.TestCase):
    def test_reserve_everything_then_one_more(self):
        inv = Inventory({"MUG": 3})
        inv.reserve("MUG", 3)
        self.assertEqual(inv.available("MUG"), 0)
        with self.assertRaises(OutOfStock):
            inv.reserve("MUG", 1)

    def test_failed_reserve_changes_nothing(self):
        inv = Inventory({"MUG": 3})
        with self.assertRaises(OutOfStock):
            inv.reserve("MUG", 4)
        self.assertEqual(inv.available("MUG"), 3)

    def test_non_int_qty(self):
        inv = Inventory({"MUG": 5})
        for bad in (1.0, 1.5, "1", None):
            with self.assertRaises(ValueError, msg=repr(bad)):
                inv.reserve("MUG", bad)
        self.assertEqual(inv.available("MUG"), 5)

    def test_bool_qty(self):
        inv = Inventory({"MUG": 5})
        with self.assertRaises(ValueError):
            inv.reserve("MUG", True)

    def test_settle_after_the_other_changes_no_stock(self):
        inv = Inventory({"MUG": 5})
        r = inv.reserve("MUG", 2)
        inv.release(r)
        with self.assertRaises(ReservationError):
            inv.commit(r)
        self.assertEqual(inv.available("MUG"), 5)
        r = inv.reserve("MUG", 2)
        inv.commit(r)
        with self.assertRaises(ReservationError):
            inv.release(r)
        self.assertEqual(inv.available("MUG"), 3)

    def test_skus_are_independent(self):
        inv = Inventory({"MUG": 2, "FILTER": 2})
        inv.reserve("MUG", 2)
        self.assertEqual(inv.available("FILTER"), 2)


class ConcurrencyTest(unittest.TestCase):
    def setUp(self):
        self.old = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)

    def tearDown(self):
        sys.setswitchinterval(self.old)

    def test_concurrent_reserves_never_oversell(self):
        for _ in range(1000):
            inv = Inventory({"MUG": 10})
            wins = race(24, lambda: inv.reserve("MUG", 1))
            self.assertEqual(wins, 10)
            self.assertEqual(inv.available("MUG"), 0)

    def test_concurrent_release_returns_stock_once(self):
        for _ in range(1000):
            inv = Inventory({"MUG": 10})
            r = inv.reserve("MUG", 4)
            wins = race(8, lambda: inv.release(r))
            self.assertEqual(wins, 1)
            self.assertEqual(inv.available("MUG"), 10)

    def test_concurrent_commit_and_release_one_wins(self):
        for _ in range(1000):
            inv = Inventory({"MUG": 10})
            r = inv.reserve("MUG", 4)
            fns = [inv.commit, inv.release] * 4
            calls = iter(fns)
            lock = threading.Lock()

            def settle():
                with lock:
                    fn = next(calls)
                fn(r)

            wins = race(8, settle)
            self.assertEqual(wins, 1)
            self.assertIn(inv.available("MUG"), (6, 10))


if __name__ == "__main__":
    unittest.main()
