"""The product catalog."""

from decimal import Decimal


class UnknownProduct(KeyError):
    pass


PRODUCTS = {
    "BEAN-ETH": ("Ethiopia Guji, 250 g", Decimal("18.50")),
    "BEAN-COL": ("Colombia Huila, 250 g", Decimal("16.00")),
    "MUG": ("Stoneware mug", Decimal("22.00")),
    "FILTER": ("Paper filters x100", Decimal("6.25")),
}


def lookup(sku):
    """Return (name, unit_price) for a SKU."""
    try:
        return PRODUCTS[sku]
    except KeyError:
        raise UnknownProduct(sku) from None
