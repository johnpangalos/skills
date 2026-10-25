import unittest

from paykit.registry import get_provider
from paykit.transport import FakeTransport


class RegistryTest(unittest.TestCase):
    def test_known_providers(self):
        for name in ("acme", "globex"):
            p = get_provider(name, api_key="k", secret="s", webhook_secret="w", transport=FakeTransport())
            self.assertEqual(p.name, name)

    def test_unknown(self):
        with self.assertRaises(KeyError):
            get_provider("nope")
