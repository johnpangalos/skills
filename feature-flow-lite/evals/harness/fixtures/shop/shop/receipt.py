"""Plain-text receipts."""

from shop.money import format_money

WIDTH = 40


def _row(label, amount):
    value = format_money(amount)
    return label + value.rjust(WIDTH - len(label))


def render(cart):
    """Render a cart as a fixed-width receipt."""
    lines = []
    for item in cart.items.values():
        lines.append(_row(f"{item.qty} x {item.name}", item.total))
    lines.append("-" * WIDTH)
    lines.append(_row("Subtotal", cart.subtotal()))
    lines.append(_row("Shipping", cart.shipping()))
    lines.append(_row("Tax", cart.tax()))
    lines.append(_row("Total", cart.total()))
    return "\n".join(lines)
