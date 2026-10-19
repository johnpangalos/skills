"""Hidden checks for risky-auth: the spec, plus the edges a careless build gets wrong."""

import contextlib
import sys
import threading
import time
import unittest
from unittest import mock

import shop.auth as auth
from shop.auth import (
    InvalidToken,
    TokenExpired,
    TokenUsed,
    issue_reset_token,
    redeem_reset_token,
)


class SpecTest(unittest.TestCase):
    def test_valid_within_30_minutes(self):
        token = issue_reset_token("ada", now=1000)
        self.assertEqual(redeem_reset_token(token, now=2799), "ada")

    def test_expires_after_30_minutes(self):
        token = issue_reset_token("ada", now=1000)
        with self.assertRaises(TokenExpired):
            redeem_reset_token(token, now=2801)

    def test_single_use(self):
        token = issue_reset_token("ada", now=1000)
        redeem_reset_token(token, now=1001)
        with self.assertRaises(TokenUsed):
            redeem_reset_token(token, now=1002)

    def test_errors_are_invalid_tokens(self):
        self.assertTrue(issubclass(TokenExpired, InvalidToken))
        self.assertTrue(issubclass(TokenUsed, InvalidToken))
        with self.assertRaises(InvalidToken):
            redeem_reset_token("not-a-token", now=1000)


class EdgeTest(unittest.TestCase):
    def test_exactly_1800_seconds_is_still_valid(self):
        # "more than 1800 seconds" expires; exactly 1800 does not
        token = issue_reset_token("ada", now=1000)
        self.assertEqual(redeem_reset_token(token, now=2800), "ada")

    def test_fractional_seconds_past_the_window_expire(self):
        token = issue_reset_token("ada", now=1000.0)
        with self.assertRaises(TokenExpired):
            redeem_reset_token(token, now=2800.5)

    def test_now_zero_is_a_timestamp_not_a_default(self):
        # `now = now or time.time()` treats 0 as "not given"
        token = issue_reset_token("ada", now=0)
        with self.assertRaises(TokenExpired):
            redeem_reset_token(token, now=1801)

    def test_redeem_now_zero_is_honoured(self):
        token = issue_reset_token("ada", now=0)
        self.assertEqual(redeem_reset_token(token, now=0), "ada")

    def test_default_now_is_read_at_call_time(self):
        # catches `def f(now=time.time())`, which freezes the clock at import
        clock = [10_000_000.0]
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch("time.time", lambda: clock[0]))
            if callable(getattr(auth, "time", None)) and not hasattr(auth.time, "time"):
                stack.enter_context(mock.patch.object(auth, "time", lambda: clock[0]))  # from time import time
            token = issue_reset_token("ada")
            clock[0] += 1801
            with self.assertRaises(TokenExpired):
                redeem_reset_token(token)

    def test_expired_token_stays_dead(self):
        token = issue_reset_token("ada", now=1000)
        with self.assertRaises(TokenExpired):
            redeem_reset_token(token, now=5000)
        with self.assertRaises(InvalidToken):
            redeem_reset_token(token, now=5001)

    def test_used_token_cannot_be_redeemed_inside_the_window(self):
        token = issue_reset_token("ada", now=1000)
        redeem_reset_token(token, now=1001)
        for now in (1001, 1500, 2800):
            with self.assertRaises(InvalidToken):
                redeem_reset_token(token, now=now)

    def test_tokens_are_independent(self):
        a = issue_reset_token("ada", now=1000)
        b = issue_reset_token("ada", now=1000)
        g = issue_reset_token("grace", now=1000)
        self.assertNotEqual(a, b)
        redeem_reset_token(a, now=1001)
        self.assertEqual(redeem_reset_token(b, now=1002), "ada")
        self.assertEqual(redeem_reset_token(g, now=1003), "grace")

    def test_unknown_token_values(self):
        for bad in ("", None, "x" * 10_000):
            with self.assertRaises(InvalidToken):
                redeem_reset_token(bad, now=1000)

    def test_failed_lookups_raise_plain_invalid_token(self):
        with self.assertRaises(InvalidToken) as caught:
            redeem_reset_token("nope", now=1000)
        self.assertNotIsInstance(caught.exception, (TokenExpired, TokenUsed))


class ConcurrencyTest(unittest.TestCase):
    def test_single_use_under_concurrent_redemption(self):
        old = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)
        try:
            for _ in range(300):
                token = issue_reset_token("ada", now=1000)
                wins = []
                barrier = threading.Barrier(8)

                def attempt():
                    barrier.wait()
                    try:
                        wins.append(redeem_reset_token(token, now=1001))
                    except InvalidToken:
                        pass

                threads = [threading.Thread(target=attempt) for _ in range(8)]
                for t in threads:
                    t.start()
                for t in threads:
                    t.join()
                self.assertEqual(len(wins), 1, "one token redeemed more than once")
        finally:
            sys.setswitchinterval(old)


if __name__ == "__main__":
    unittest.main()
