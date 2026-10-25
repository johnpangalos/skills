from datetime import date
from shop.discounts import apply_discount
from shop.orders import Line, Order
o = Order(1, "Ada", "", 0.0, date(2026, 1, 1), [Line("Pen", 3, 333), Line("Ink", 1, 5)])
for p in [-1, 0, 1, 15, 33, 50, 99, 100, 101]:
    try: print(p, apply_discount(o, p))
    except Exception as e: print(p, type(e).__name__, e)
