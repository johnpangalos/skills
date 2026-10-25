from datetime import date, timedelta
from shop.notices import invoice_header, reminder_text, shipping_label
from shop.orders import Order
d = date(2026, 1, 1)
for i in range(0, 400, 1):
    o = Order(i, "Ada", "", 0.0, d + timedelta(days=i))
    print(shipping_label(o), invoice_header(o), reminder_text(o, i % 5 - 2))
