"""Amounts are Decimals in major units at the API surface; providers convert."""

from decimal import ROUND_HALF_UP, Decimal

EXPONENT = {"EUR": 2, "USD": 2, "GBP": 2, "JPY": 0, "KWD": 3}


def supported(currency):
    return currency.upper() in EXPONENT


def to_minor(amount, currency):
    exp = EXPONENT[currency.upper()]
    return int((Decimal(amount) * (10 ** exp)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def from_minor(units, currency):
    exp = EXPONENT[currency.upper()]
    return (Decimal(units) / (10 ** exp)).quantize(Decimal(1).scaleb(-exp))


def to_decimal_string(amount, currency):
    exp = EXPONENT[currency.upper()]
    return str(Decimal(amount).quantize(Decimal(1).scaleb(-exp), rounding=ROUND_HALF_UP))
