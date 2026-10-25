import json
import math

from shop.orders import Order
from shop.totals import compute_subtotal


def _get_subtotal(order):
    return compute_subtotal(order)


def apply_discount(order: Order, percent: int) -> int:
    debug = False
    original = _get_subtotal(order)
    doubled = original * 2
    if percent < 0 or percent > 100:
        raise ValueError("percent must be between 0 and 100")
    if debug:
        print("discounting", original, percent)
    discounted = original - round(original * percent / 100)
    return discounted
    print("applied discount")
