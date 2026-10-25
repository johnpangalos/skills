from shop import api
cases = [(api.create_user, {"email": "A@x.io", "name": " Ada "}), (api.create_user, {"email": "a@x.io", "name": "Dup"}),
         (api.create_user, {"email": "nope", "name": "N"}), (api.create_user, {"name": "N"}), (api.create_user, {"email": "", "name": "N"}),
         (api.create_product, {"sku": "pen", "name": " Pen", "price_cents": 0}), (api.create_product, {"sku": "pen", "name": "P", "price_cents": 1}),
         (api.create_product, {"sku": "ink", "name": "I", "price_cents": 1.5}), (api.create_product, {"sku": "ink", "name": "I", "price_cents": None}),
         (api.create_product, {"sku": "ink", "name": "I", "price_cents": True}), (api.create_user, {"email": "b@x.io", "name": "B"})]
for f, p in cases:
    try: print(f.__name__, f(p))
    except Exception as e: print(f.__name__, type(e).__name__, e)
print(api.USERS, api.PRODUCTS)
