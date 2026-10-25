from shop.orders import Order


def shipping_label(order: Order) -> str:
    d = order.due
    if 11 <= d.day % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(d.day % 10, "th")
    when = f"{d.day}{suffix} {d.strftime('%B %Y')}"
    return f"SHIP TO {order.customer.upper()} BY {when.upper()}"


def invoice_header(order: Order) -> str:
    d = order.due
    if 11 <= d.day % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(d.day % 10, "th")
    when = f"{d.day}{suffix} {d.strftime('%B %Y')}"
    return f"Invoice #{order.id} - due {when}"


def reminder_text(order: Order, days_left: int) -> str:
    d = order.due
    if 11 <= d.day % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(d.day % 10, "th")
    when = f"{d.day}{suffix} {d.strftime('%B %Y')}"
    if days_left <= 0:
        return f"Hi {order.customer}, your payment was due on the {when}."
    return f"Hi {order.customer}, your payment is due on the {when} ({days_left} days left)."
