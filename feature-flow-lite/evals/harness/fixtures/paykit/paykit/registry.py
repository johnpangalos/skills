"""Look up a provider client by name."""

from paykit.providers.acme import AcmePay
from paykit.providers.globex import GlobexPay

PROVIDERS = {
    "acme": AcmePay,
    "globex": GlobexPay,
}


def get_provider(name, **kwargs):
    try:
        cls = PROVIDERS[name]
    except KeyError:
        raise KeyError(f"unknown provider {name!r}; known: {', '.join(sorted(PROVIDERS))}") from None
    return cls(**kwargs)
