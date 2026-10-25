from datetime import date
from shop.orders import Line, Order
from shop.pages import render_invoice_page, render_receipt_page
for o in [Order(7, "Ada", "GB123", 0.2, date(2026, 3, 1), [Line("Pen", 2, 150), Line("Ink", 1, 1299)]),
          Order(8, "Bo", "", 0.0, date(2026, 12, 31), []),
          Order(9, "Cy", "X", 0.175, date(2027, 1, 2), [Line("Desk", 3, 123456)])]:
    print(render_invoice_page(o)); print(render_receipt_page(o))
