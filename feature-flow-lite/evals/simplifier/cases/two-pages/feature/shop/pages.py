from shop.orders import Order


def render_invoice_page(order: Order) -> str:
    rows = []
    for line in order.lines:
        total = line.qty * line.unit_cents
        rows.append(
            f"<tr><td>{line.name}</td><td>{line.qty}</td>"
            f"<td>${line.unit_cents / 100:,.2f}</td><td>${total / 100:,.2f}</td></tr>"
        )
    subtotal = sum(line.qty * line.unit_cents for line in order.lines)
    tax = round(subtotal * order.tax_rate)
    return "\n".join([
        "<html><head><title>Invoice</title></head><body>",
        f"<h1>Invoice #{order.id}</h1>",
        f"<p>Billed to: {order.customer}</p>",
        f"<p>Tax ID: {order.tax_id}</p>",
        f"<p>Due: {order.due.isoformat()}</p>",
        "<table>",
        *rows,
        "</table>",
        f"<p>Subtotal: ${subtotal / 100:,.2f}</p>",
        f"<p>Tax: ${tax / 100:,.2f}</p>",
        f"<p>Amount due: ${(subtotal + tax) / 100:,.2f}</p>",
        "<footer>Please pay within 30 days.</footer>",
        "</body></html>",
    ])


def render_receipt_page(order: Order) -> str:
    rows = []
    for line in order.lines:
        total = line.qty * line.unit_cents
        rows.append(
            f"<tr><td>{line.name}</td><td>{line.qty}</td><td>${total / 100:,.2f}</td></tr>"
        )
    subtotal = sum(line.qty * line.unit_cents for line in order.lines)
    tax = round(subtotal * order.tax_rate)
    return "\n".join([
        "<html><head><title>Receipt</title></head><body>",
        f"<h1>Receipt for order #{order.id}</h1>",
        f"<p>Thanks, {order.customer}!</p>",
        "<table>",
        *rows,
        "</table>",
        f"<p>Subtotal: ${subtotal / 100:,.2f}</p>",
        f"<p>Tax: ${tax / 100:,.2f}</p>",
        f"<p>Paid: ${(subtotal + tax) / 100:,.2f}</p>",
        "<footer>Thanks for shopping with us.</footer>",
        "</body></html>",
    ])
