class ValidationError(Exception):
    pass


USERS: dict[int, dict] = {}
PRODUCTS: dict[int, dict] = {}


def create_user(payload: dict) -> dict:
    for field in ("email", "name"):
        if field not in payload or payload[field] in ("", None):
            raise ValidationError(f"missing field: {field}")
    if "@" not in payload["email"]:
        raise ValidationError("email must contain @")
    if any(u["email"] == payload["email"] for u in USERS.values()):
        raise ValidationError("email already taken")
    user_id = len(USERS) + 1
    user = {"id": user_id, "email": payload["email"].lower(), "name": payload["name"].strip()}
    USERS[user_id] = user
    return user


def create_product(payload: dict) -> dict:
    for field in ("sku", "name", "price_cents"):
        if field not in payload or payload[field] in ("", None):
            raise ValidationError(f"missing field: {field}")
    if not isinstance(payload["price_cents"], int) or payload["price_cents"] < 0:
        raise ValidationError("price_cents must be a non-negative integer")
    if any(p["sku"] == payload["sku"] for p in PRODUCTS.values()):
        raise ValidationError("sku already taken")
    product_id = len(PRODUCTS) + 1
    product = {"id": product_id, "sku": payload["sku"].upper(), "name": payload["name"].strip(),
               "price_cents": payload["price_cents"]}
    PRODUCTS[product_id] = product
    return product
