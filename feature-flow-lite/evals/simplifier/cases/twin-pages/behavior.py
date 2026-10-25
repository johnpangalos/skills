from datetime import date
from shop.emails import order_confirmed_page, order_shipped_page
from shop.orders import Line, Order
for o in [Order(7, "Ada", "", 0.0, date(2026, 3, 1), [Line("Pen", 2, 150), Line("Ink", 1, 1)]), Order(8, "Bo", "", 0.0, date(2027, 1, 9), [])]:
    print(order_confirmed_page(o)); print(order_shipped_page(o))
