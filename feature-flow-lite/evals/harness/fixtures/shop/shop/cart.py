"""Cart totals."""

from dataclasses import dataclass
from decimal import Decimal

from shop.catalog import lookup
from shop.money import to_cents

TAX_RATE = Decimal("0.0825")  # merchandise only; shipping is not taxed
SHIPPING_FLAT = Decimal("7.95")
FREE_SHIPPING_OVER = Decimal("75.00")  # merchandise subtotal, inclusive


@dataclass
class LineItem:
    sku: str
    name: str
    unit_price: Decimal
    qty: int

    @property
    def total(self):
        return self.unit_price * self.qty


class Cart:
    def __init__(self):
        self.items = {}

    def add(self, sku, qty=1):
        if qty < 1:
            raise ValueError("qty must be at least 1")
        if sku in self.items:
            self.items[sku].qty += qty
        else:
            name, price = lookup(sku)
            self.items[sku] = LineItem(sku, name, price, qty)

    def remove(self, sku):
        self.items.pop(sku, None)

    def subtotal(self):
        return to_cents(sum((item.total for item in self.items.values()), Decimal("0")))

    def shipping(self):
        if not self.items or self.subtotal() >= FREE_SHIPPING_OVER:
            return Decimal("0.00")
        return SHIPPING_FLAT

    def tax(self):
        return to_cents(self.subtotal() * TAX_RATE)

    def total(self):
        return self.subtotal() + self.shipping() + self.tax()
