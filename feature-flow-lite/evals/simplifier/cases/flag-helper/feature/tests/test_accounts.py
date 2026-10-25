import unittest

from shop import accounts, mail


class AccountsTest(unittest.TestCase):
    def setUp(self):
        mail.OUTBOX.clear(); accounts.USERS.clear(); accounts.RESET_TOKENS.clear()

    def test_register_sends_welcome(self):
        accounts.register_user("a@x.io")
        self.assertEqual(mail.OUTBOX, [("a@x.io", "Welcome to the shop", "Hi a@x.io, thanks for signing up.")])

    def test_reset_sends_link_with_token(self):
        accounts.register_user("a@x.io")
        token = accounts.request_password_reset("a@x.io")
        self.assertEqual(mail.OUTBOX[-1][1], "Reset your password")
        self.assertIn(f"token={token}", mail.OUTBOX[-1][2])

    def test_reset_unknown_user(self):
        with self.assertRaises(KeyError):
            accounts.request_password_reset("nobody@x.io")
