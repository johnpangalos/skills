import unittest

from shop.auth import (
    InvalidToken,
    TokenExpired,
    TokenUsed,
    issue_reset_token,
    redeem_reset_token,
)


class ResetTokenExpiryTest(unittest.TestCase):
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

    def test_now_defaults_to_wall_clock(self):
        token = issue_reset_token("grace")
        self.assertEqual(redeem_reset_token(token), "grace")
