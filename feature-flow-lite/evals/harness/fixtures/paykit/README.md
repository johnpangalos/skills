# paykit

One client interface over several payment providers.

```python
from paykit.registry import get_provider

acme = get_provider("acme", api_key="...", secret="...", webhook_secret="...")
charge = acme.charge(Decimal("12.50"), "EUR", source="tok_visa")
```

Providers live in `paykit/providers/`; each one is registered in `paykit/registry.py`.

```sh
python3 -m unittest discover -s tests -q
```
