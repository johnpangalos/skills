"""Stress check for risky-auth: single use must hold when threads are forced to interleave."""

import unittest

from _interleave import interleaved, race
from shop.auth import InvalidToken, issue_reset_token, redeem_reset_token


class StressTest(unittest.TestCase):
    def test_single_use_with_forced_interleaving(self):
        with interleaved("shop"):
            for trial in range(40):
                token = issue_reset_token("ada", now=1000)
                results = race(lambda: redeem_reset_token(token, now=1001), n=8)
                wins = [r for r in results if not isinstance(r, Exception)]
                stray = [r for r in results if isinstance(r, Exception) and not isinstance(r, InvalidToken)]
                self.assertEqual(stray, [], f"trial {trial}: redeem raised something other than InvalidToken")
                self.assertEqual(len(wins), 1, f"trial {trial}: one token redeemed {len(wins)} times")


if __name__ == "__main__":
    unittest.main()
