from shop.orders import Order


def compute_subtotal(order: Order) -> int:
    return sum(line.qty * line.unit_cents for line in order.lines)
