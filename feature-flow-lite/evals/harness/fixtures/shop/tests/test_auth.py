import unittest

from shop.auth import InvalidToken, issue_reset_token, redeem_reset_token


class ResetTokenTest(unittest.TestCase):
    def test_round_trip(self):
        token = issue_reset_token("ada")
        self.assertEqual(redeem_reset_token(token), "ada")

    def test_unknown_token(self):
        with self.assertRaises(InvalidToken):
            redeem_reset_token("not-a-token")
