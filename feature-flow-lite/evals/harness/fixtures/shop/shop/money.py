"""Money helpers. Amounts are Decimal dollars."""

from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def to_cents(amount):
    """Round to whole cents, half-up."""
    return Decimal(amount).quantize(CENT, rounding=ROUND_HALF_UP)


def format_money(amount):
    """Format as dollars, e.g. $1,234.50."""
    return f"${to_cents(amount):,.2f}"
