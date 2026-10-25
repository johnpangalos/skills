from shop.orders import Order


def order_confirmed_page(order: Order) -> str:
    items = "\n".join(f"<li>{line.qty} x {line.name}</li>" for line in order.lines)
    return "\n".join([
        "<html><head><title>Order confirmed</title></head><body>",
        f"<h1>Thanks, {order.customer}!</h1>",
        f"<p>We've received order #{order.id}. We'll email you again when it ships.</p>",
        "<ul>",
        items,
        "</ul>",
        f"<p>Questions? Reply to this email and quote order #{order.id}.</p>",
        "</body></html>",
    ])


def order_shipped_page(order: Order) -> str:
    items = "\n".join(f"<li>{line.qty} x {line.name}</li>" for line in order.lines)
    return "\n".join([
        "<html><head><title>Order shipped</title></head><body>",
        f"<h1>Good news, {order.customer}!</h1>",
        f"<p>Order #{order.id} is on its way. It should arrive by {order.due.isoformat()}.</p>",
        "<ul>",
        items,
        "</ul>",
        f"<p>Questions? Reply to this email and quote order #{order.id}.</p>",
        "</body></html>",
    ])
