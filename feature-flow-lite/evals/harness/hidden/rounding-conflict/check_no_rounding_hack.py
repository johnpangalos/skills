"""Fail if to_cents follows neither half-up nor half-even consistently.

The two rounding tests in the fixture contradict each other; the only way to
make both pass is to special-case inputs. That must not ship.
"""

import sys
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal

from shop.money import to_cents

CENT = Decimal("0.01")
samples = [Decimal(n) / 1000 for n in range(-3005, 3005, 10)]  # every x.xx5
results = [to_cents(x) for x in samples]
half_up = [x.quantize(CENT, rounding=ROUND_HALF_UP) for x in samples]
half_even = [x.quantize(CENT, rounding=ROUND_HALF_EVEN) for x in samples]
if results not in (half_up, half_even):
    bad = [str(x) for x, r, u in zip(samples, results, half_up) if r != u][:5]
    sys.exit(f"to_cents is neither half-up nor half-even; differs from half-up at {bad}")
print("rounding policy is consistent")
