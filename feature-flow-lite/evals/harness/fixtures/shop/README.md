# shop

Checkout logic for a small online coffee shop: catalog, cart totals, receipts,
and password-reset tokens. Standard library only.

    ./check.sh        # lint + unit tests (run before every commit)

Money is `Decimal` dollars, rounded to cents half-up (`shop/money.py`).
Shipping is a flat $7.95, free once the merchandise subtotal reaches $75.
Sales tax is 8.25% of merchandise only; shipping is not taxed.
