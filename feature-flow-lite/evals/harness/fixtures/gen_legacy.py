"""Generate `ledgerline`, a legacy billing monolith, into the current directory.

About 300 Python files and 40k lines: a real pricing path, a bug buried in a
compat hook that's loaded by name from config, decoys that look more guilty
than the culprit, an outdated architecture doc, and a lot of unrelated filler.
Deterministic, so every run gets the same repo.

The bug: EU orders with a coupon get VAT twice, because
ledgerline/compat/hooks/cent_rules.py "restores" coupon VAT a second time.
"""

import pathlib
import random
import sys
import textwrap

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
rng = random.Random(1987)


def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(text).lstrip("\n"))


# --- the real pricing path ---------------------------------------------------

write("ledgerline/__init__.py", '''
    """Ledgerline billing platform."""

    VERSION = "4.17.2"
''')

write("ledgerline/core/__init__.py", "")
write("ledgerline/core/config.py", '''
    """Runtime configuration, loaded once at import time.

    PRICING_PIPELINE lists the stages a quote runs through, in order. Each entry
    is a dotted module path; the module must expose apply(ctx) -> ctx.
    """

    PRICING_PIPELINE = [
        "ledgerline.pricing.stages.base",
        "ledgerline.pricing.stages.discounts",
        "ledgerline.pricing.stages.taxes",
        "ledgerline.pricing.stages.shipping",
        "ledgerline.compat.hooks.cent_rules",
    ]

    FREE_SHIPPING_OVER = {"EUR": 4000, "USD": 5000, "JPY": 6000}
    FLAT_SHIPPING = {"EUR": 495, "USD": 599, "JPY": 700}

    REPORTING_TIMEZONE = "Europe/Berlin"
    EXPORT_BATCH_SIZE = 500
    NOTIFY_RETRY_LIMIT = 4
''')

write("ledgerline/core/registry.py", '''
    """Loads pipeline stages and plugins by dotted path."""

    import importlib

    _cache = {}


    def stage(path):
        """Return the module at `path`, importing it once."""
        if path not in _cache:
            _cache[path] = importlib.import_module(path)
        return _cache[path]


    def clear():
        _cache.clear()
''')

write("ledgerline/core/errors.py", '''
    class LedgerlineError(Exception):
        """Base class for platform errors."""


    class ValidationError(LedgerlineError):
        pass


    class NotFound(LedgerlineError):
        pass


    class Conflict(LedgerlineError):
        pass
''')

write("ledgerline/core/events.py", '''
    """A tiny in-process event bus used by the filler services."""

    _subscribers = {}
    _log = []


    def subscribe(name, fn):
        _subscribers.setdefault(name, []).append(fn)


    def emit(name, **payload):
        _log.append((name, payload))
        for fn in _subscribers.get(name, []):
            fn(**payload)
        return len(_log)


    def history(name=None):
        return [e for e in _log if name is None or e[0] == name]
''')

write("ledgerline/regions/__init__.py", "")
write("ledgerline/regions/tables.py", '''
    """Region reference data. `factor` is the standard consumption-tax rate."""

    REGIONS = {
        "DE": {"currency": "EUR", "factor": 0.19, "eu": True, "label": "Germany"},
        "FR": {"currency": "EUR", "factor": 0.20, "eu": True, "label": "France"},
        "NL": {"currency": "EUR", "factor": 0.21, "eu": True, "label": "Netherlands"},
        "US": {"currency": "USD", "factor": 0.0, "eu": False, "label": "United States"},
        "JP": {"currency": "JPY", "factor": 0.10, "eu": False, "label": "Japan"},
    }


    def region_factor(code):
        return REGIONS[code]["factor"]


    def currency_for(code):
        return REGIONS[code]["currency"]


    def is_eu(code):
        return REGIONS[code]["eu"]


    def label(code):
        return REGIONS[code]["label"]
''')

write("ledgerline/pricing/__init__.py", "")
write("ledgerline/pricing/money.py", '''
    """Money helpers. Amounts are integer minor units (cents, yen)."""

    import math

    SYMBOLS = {"EUR": "€", "USD": "$", "JPY": "¥"}
    EXPONENT = {"EUR": 2, "USD": 2, "JPY": 0}


    def round_half_up(x):
        return int(math.floor(x + 0.5))


    def round_half_even(x):
        return int(round(x))


    def fmt(amount, currency):
        exp = EXPONENT[currency]
        if exp == 0:
            return f"{SYMBOLS[currency]}{amount}"
        return f"{SYMBOLS[currency]}{amount // 100}.{amount % 100:02d}"
''')

write("ledgerline/pricing/pipeline.py", '''
    """Runs an order through the configured pricing stages."""

    from dataclasses import dataclass

    from ledgerline.core import config, registry
    from ledgerline.regions.tables import currency_for


    @dataclass
    class Quote:
        region: str
        currency: str
        subtotal: int
        discount: int
        tax: int
        shipping: int
        total: int
        coupon: str = None


    def price(order):
        ctx = {
            "region": order.region,
            "currency": currency_for(order.region),
            "lines": list(order.lines),
            "coupon": order.coupon,
            "subtotal": 0,
            "discount": 0,
            "tax_exact": 0.0,
            "tax": 0,
            "shipping": 0,
        }
        for path in config.PRICING_PIPELINE:
            ctx = registry.stage(path).apply(ctx)
        total = ctx["subtotal"] - ctx["discount"] + ctx["tax"] + ctx["shipping"]
        return Quote(
            region=ctx["region"], currency=ctx["currency"], subtotal=ctx["subtotal"],
            discount=ctx["discount"], tax=ctx["tax"], shipping=ctx["shipping"],
            total=total, coupon=ctx["coupon"],
        )
''')

write("ledgerline/pricing/stages/__init__.py", "")
write("ledgerline/pricing/stages/base.py", '''
    def apply(ctx):
        ctx["subtotal"] = sum(unit * qty for _sku, unit, qty in ctx["lines"])
        return ctx
''')
write("ledgerline/pricing/stages/discounts.py", '''
    from ledgerline.promotions.catalog import lookup


    def apply(ctx):
        code = ctx.get("coupon")
        if not code:
            return ctx
        promo = lookup(code)
        if promo["kind"] == "percent":
            ctx["discount"] = ctx["subtotal"] * promo["value"] // 100
        else:
            ctx["discount"] = min(promo["value"], ctx["subtotal"])
        return ctx
''')
write("ledgerline/pricing/stages/taxes.py", '''
    from ledgerline.pricing.money import round_half_up
    from ledgerline.regions.tables import region_factor


    def apply(ctx):
        net = ctx["subtotal"] - ctx["discount"]
        ctx["tax_exact"] = net * region_factor(ctx["region"])
        ctx["tax"] = round_half_up(ctx["tax_exact"])
        return ctx
''')
write("ledgerline/pricing/stages/shipping.py", '''
    from ledgerline.core.config import FLAT_SHIPPING, FREE_SHIPPING_OVER


    def apply(ctx):
        net = ctx["subtotal"] - ctx["discount"]
        cur = ctx["currency"]
        ctx["shipping"] = 0 if net >= FREE_SHIPPING_OVER[cur] else FLAT_SHIPPING[cur]
        return ctx
''')

write("ledgerline/compat/__init__.py", '''
    """Compatibility layer kept from the 2019 billing system migration."""
''')
write("ledgerline/compat/hooks/__init__.py", "")
write("ledgerline/compat/hooks/cent_rules.py", '''
    """Per-region cent rules carried over from the 2019 billing system.

    The old system rounded EU consumption tax half-to-even and truncated it in
    Japan; finance still reconciles against those rules.
    """

    from ledgerline.pricing.money import round_half_even
    from ledgerline.regions.tables import is_eu, region_factor


    def apply(ctx):
        region = ctx["region"]
        if is_eu(region):
            ctx["tax"] = round_half_even(ctx["tax_exact"])
            if ctx.get("coupon"):
                # BL-2291: the old system stored coupons net of tax, so restore the gross amount
                ctx["tax"] += round_half_even(ctx["subtotal"] * region_factor(region))
        elif region == "JP":
            ctx["tax"] = int(ctx["tax_exact"])
        return ctx
''')
write("ledgerline/compat/shims.py", '''
    """Name shims for callers that still import from the 2019 module layout."""

    from ledgerline.pricing.money import fmt as format_money  # noqa: F401
    from ledgerline.pricing.pipeline import price as compute_quote  # noqa: F401
''')

write("ledgerline/promotions/__init__.py", "")
write("ledgerline/promotions/catalog.py", '''
    from ledgerline.core.errors import NotFound

    PROMOS = {
        "SAVE10": {"kind": "percent", "value": 10},
        "SAVE25": {"kind": "percent", "value": 25},
        "WELCOME5": {"kind": "fixed", "value": 500},
    }


    def lookup(code):
        try:
            return PROMOS[code.upper()]
        except KeyError:
            raise NotFound(f"unknown coupon {code!r}") from None
''')
# decoy: looks like the coupon-VAT culprit, but nothing imports it
write("ledgerline/promotions/legacy_coupons.py", '''
    """Coupon handling from before the pricing pipeline (2017-2019). Unused."""

    from ledgerline.billing.vat import vat_rate


    def gross_up(amount, region):
        """Old coupons were stored net; add VAT back on top of the coupon value."""
        return amount + amount * vat_rate(region)


    def coupon_vat(order, coupon_value):
        return round(coupon_value * vat_rate(order.region) * 2)
''')

write("ledgerline/orders/__init__.py", "")
write("ledgerline/orders/model.py", '''
    from dataclasses import dataclass, field


    @dataclass
    class Order:
        region: str
        lines: list = field(default_factory=list)   # (sku, unit price in minor units, qty)
        coupon: str = None
        customer_id: str = "anonymous"
        reference: str = "ORD-0"
''')

write("ledgerline/invoicing/__init__.py", "")
write("ledgerline/invoicing/build.py", '''
    """Builds customer invoices from priced orders."""

    from dataclasses import dataclass

    from ledgerline.invoicing.render import render_text
    from ledgerline.pricing.pipeline import price
    from ledgerline.regions.tables import region_factor


    @dataclass
    class Invoice:
        reference: str
        quote: object
        tax_label: str
        text: str


    def build_invoice(order):
        quote = price(order)
        rate = round(region_factor(order.region) * 100)
        label = f"VAT {rate}%" if order.region != "US" else "Sales tax"
        inv = Invoice(order.reference, quote, label, "")
        inv.text = render_text(inv)
        return inv
''')
write("ledgerline/invoicing/render.py", '''
    from ledgerline.pricing.money import fmt


    def render_text(inv):
        q = inv.quote
        rows = [
            f"Invoice {inv.reference}",
            f"Subtotal: {fmt(q.subtotal, q.currency)}",
        ]
        if q.discount:
            rows.append(f"Discount ({q.coupon}): -{fmt(q.discount, q.currency)}")
        rows += [
            f"{inv.tax_label}: {fmt(q.tax, q.currency)}",
            f"Shipping: {fmt(q.shipping, q.currency)}",
            f"Total: {fmt(q.total, q.currency)}",
        ]
        return "\\n".join(rows)
''')

write("ledgerline/exports/__init__.py", "")
write("ledgerline/exports/ledger.py", '''
    """Nightly export of priced orders to the finance ledger."""

    from ledgerline.pricing.pipeline import price


    def ledger_rows(orders):
        rows = []
        for order in orders:
            q = price(order)
            rows.append({
                "reference": order.reference,
                "currency": q.currency,
                "net": q.subtotal - q.discount,
                "tax": q.tax,
                "shipping": q.shipping,
                "gross": q.total,
            })
        return rows
''')

write("ledgerline/api/__init__.py", "")
write("ledgerline/api/quote.py", '''
    """JSON quote endpoint used by the storefront."""

    from ledgerline.pricing.pipeline import price


    def quote_json(order):
        q = price(order)
        return {
            "currency": q.currency,
            "subtotal": q.subtotal,
            "discount": q.discount,
            "tax": q.tax,
            "shipping": q.shipping,
            "total": q.total,
        }
''')

# decoys in billing/: an old VAT module (still used by reporting) and a dead invoice builder
write("ledgerline/billing/__init__.py", "")
write("ledgerline/billing/vat.py", '''
    """VAT helpers from the 2017 billing module.

    Still used by reporting for the quarterly VAT summary. New pricing code uses
    ledgerline.regions.tables instead.
    """

    VAT = {"DE": 0.19, "FR": 0.20, "AT": 0.20, "US": 0.0, "JP": 0.10}


    def vat_rate(region):
        return VAT.get(region, 0.0)


    def vat_on(net_cents, region):
        return round(net_cents * vat_rate(region))


    def apply_coupon_vat(order_total, coupon_cents, region):
        # TODO(BL-1180): coupons and VAT, revisit after the pipeline migration
        return order_total + vat_on(coupon_cents, region) + vat_on(coupon_cents, region)


    def quarterly_summary(rows):
        out = {}
        for row in rows:
            out.setdefault(row["region"], 0)
            out[row["region"]] += vat_on(row["net"], row["region"])
        return out
''')
write("ledgerline/billing/invoices_v1.py", '''
    """Invoice builder v1. Deprecated in 2019; kept for the archive exporter."""

    from ledgerline.billing.vat import apply_coupon_vat, vat_on


    def build(order, subtotal, coupon_cents=0):
        net = subtotal - coupon_cents
        total = net + vat_on(net, order.region)
        if coupon_cents:
            total = apply_coupon_vat(total, coupon_cents, order.region)
        return {"reference": order.reference, "total": total}
''')

write("docs/ARCHITECTURE.md", '''
    # Ledgerline architecture

    _Last updated 2018._

    - `billing/` computes VAT (`billing/vat.py`) and builds invoices (`billing/invoices_v1.py`).
    - `promotions/` holds coupon logic; coupons are stored net of tax and grossed up in
      `promotions/legacy_coupons.py`.
    - Domain services (`inventory/`, `crm/`, `warehouse/`, ...) publish events on
      `core/events.py`.
''')
write("README.md", '''
    # ledgerline

    Billing platform: pricing, invoicing, ledger exports and a dozen back-office services.

    ```sh
    python3 -m unittest discover -s tests -q
    ```

    See docs/ARCHITECTURE.md for an overview.
''')

# --- tests for the real path (all pass before the fix: none uses an EU coupon) ----

write("tests/__init__.py", "")
write("tests/test_pricing.py", '''
    import unittest

    from ledgerline.orders.model import Order
    from ledgerline.pricing.pipeline import price


    class PricingTest(unittest.TestCase):
        def test_de_without_coupon(self):
            q = price(Order("DE", [("BK-1", 2500, 2)]))
            self.assertEqual((q.subtotal, q.tax, q.shipping, q.total), (5000, 950, 0, 5950))

        def test_eu_tax_rounds_half_even(self):
            q = price(Order("DE", [("BK-2", 2350, 1)]))  # 446.5 cents of VAT
            self.assertEqual(q.tax, 446)

        def test_us_coupon(self):
            q = price(Order("US", [("BK-3", 6000, 1)], coupon="SAVE10"))
            self.assertEqual((q.discount, q.tax, q.total), (600, 0, 5400))

        def test_jp_truncates(self):
            q = price(Order("JP", [("BK-4", 1995, 1)]))
            self.assertEqual(q.tax, 199)

        def test_small_order_pays_shipping(self):
            q = price(Order("FR", [("BK-5", 1000, 1)]))
            self.assertEqual(q.shipping, 495)
''')
write("tests/test_invoicing.py", '''
    import unittest

    from ledgerline.invoicing.build import build_invoice
    from ledgerline.orders.model import Order


    class InvoiceTest(unittest.TestCase):
        def test_invoice_text(self):
            inv = build_invoice(Order("DE", [("BK-1", 2500, 2)], reference="ORD-9"))
            self.assertIn("VAT 19%: €9.50", inv.text)
            self.assertIn("Total: €59.50", inv.text)

        def test_us_label(self):
            inv = build_invoice(Order("US", [("BK-1", 2500, 2)]))
            self.assertEqual(inv.tax_label, "Sales tax")
''')
write("tests/test_exports.py", '''
    import unittest

    from ledgerline.exports.ledger import ledger_rows
    from ledgerline.orders.model import Order


    class LedgerTest(unittest.TestCase):
        def test_gross_is_net_plus_tax_plus_shipping(self):
            [row] = ledger_rows([Order("NL", [("BK-7", 3000, 1)], reference="ORD-1")])
            self.assertEqual(row["gross"], row["net"] + row["tax"] + row["shipping"])
            self.assertEqual(row["tax"], 630)
''')

# --- filler: a dozen back-office domains of plausible, unrelated code ---------------

DOMAINS = {
    "inventory": ["stock", "bin", "lot", "sku", "reorder", "count"],
    "crm": ["contact", "account", "lead", "segment", "note", "owner"],
    "shipping_ops": ["parcel", "carrier", "label", "route", "manifest", "pickup"],
    "notifications": ["email", "sms", "template", "digest", "channel", "optout"],
    "reporting": ["summary", "tax_report", "revenue", "cohort", "export", "kpi"],
    "auth": ["session", "token", "role", "grant", "audit", "password"],
    "scheduling": ["job", "slot", "calendar", "window", "cron", "holiday"],
    "warehouse": ["dock", "pallet", "zone", "picker", "wave", "putaway"],
    "analytics": ["event", "funnel", "metric", "sample", "dashboard", "retention"],
    "integrations": ["webhook", "erp", "feed", "mapping", "sync", "partner"],
    "catalog": ["product", "variant", "price_list", "media", "category", "bundle"],
    "support": ["ticket", "macro", "sla", "queue", "csat", "escalation"],
}
VERBS = ["load", "save", "merge", "split", "validate", "normalize", "archive", "restore",
         "rebuild", "reconcile", "summarize", "dispatch", "expire", "schedule", "replay"]
FIELDS = ["status", "owner", "created_at", "updated_at", "region", "priority", "amount",
          "quantity", "notes", "source", "external_id", "tags", "version", "currency"]


def filler_module(domain, noun, n):
    cls = "".join(w.capitalize() for w in noun.split("_")) + ("Service" if n % 2 else "Manager")
    fields = rng.sample(FIELDS, 6)
    verbs = rng.sample(VERBS, 9)
    lines = [
        f'"""{noun.replace("_", " ").capitalize()} handling for {domain} (module {n})."""',
        "",
        "from dataclasses import dataclass, field",
        "",
        "from ledgerline.core import events",
        "from ledgerline.core.errors import NotFound, ValidationError",
    ]
    if domain == "reporting":
        lines.append("from ledgerline.billing.vat import vat_on")
    if domain in ("catalog", "reporting", "integrations"):
        lines.append("from ledgerline.pricing.money import fmt")
    lines += ["", f"BATCH = {rng.choice([25, 50, 100, 250])}", f"RETRIES = {rng.randint(1, 5)}", "", "",
              "@dataclass", f"class {cls[:-7] if cls.endswith('Service') else cls[:-7]}Record:"]
    for f in fields:
        default = {"amount": "0", "quantity": "0", "version": "1", "tags": "field(default_factory=list)"}.get(f, '""')
        lines.append(f"    {f}: object = {default}")
    lines += ["    id: str = \"\"", "", "", f"class {cls}:", f'    """Keeps {noun.replace("_", " ")} records in memory."""', "",
              "    def __init__(self):", "        self._items = {}", "        self._seq = 0", ""]
    for v in verbs:
        lines += [f"    def {v}(self, key, **changes):",
                  f'        """{v.capitalize()} one {noun.replace("_", " ")} record."""',
                  "        if not key:",
                  f'            raise ValidationError("{noun} key is required")',
                  "        item = self._items.get(key)",
                  "        if item is None:",
                  f"            if {'True' if v in ('save', 'merge', 'restore') else 'False'}:",
                  "                self._seq += 1",
                  "                item = self._items[key] = {\"id\": key, \"seq\": self._seq}",
                  "            else:",
                  f'                raise NotFound(f"{noun} {{key}} not found")',
                  "        for name, value in changes.items():",
                  "            if name.startswith(\"_\"):",
                  "                continue",
                  "            item[name] = value",
                  f'        events.emit("{domain}.{noun}.{v}", key=key)',
                  "        return dict(item)",
                  ""]
    lines += ["    def all(self):", "        return [dict(v) for v in self._items.values()]", "",
              "    def count(self):", "        return len(self._items)", "", ""]
    for k in range(4):
        a, b = rng.sample(fields, 2)
        lines += [f"def {rng.choice(VERBS)}_{noun}_{k}(records):",
                  f'    """Group records by {a} and total their {b}."""',
                  "    out = {}",
                  "    for r in records:",
                  f"        bucket = out.setdefault(str(r.get(\"{a}\", \"\")), [])",
                  f"        bucket.append(r.get(\"{b}\"))",
                  "    return {k: len(v) for k, v in out.items()}", "", ""]
    if domain == "reporting" and noun == "tax_report":
        lines += ["def vat_total(rows):", '    """Quarterly VAT owed, from the 2017 rates."""',
                  "    return sum(vat_on(r[\"net\"], r[\"region\"]) for r in rows)", ""]
    return "\n".join(lines).rstrip() + "\n"


count = 0
for domain, nouns in DOMAINS.items():
    write(f"ledgerline/{domain}/__init__.py", "")
    made = []
    for n in range(22):
        noun = nouns[n % len(nouns)]
        mod = f"{noun}_{n:02d}"
        write(f"ledgerline/{domain}/{mod}.py", filler_module(domain, noun, n))
        made.append(mod)
        count += 1
    picks = made[:3]
    body = ["import unittest", ""]
    body += [f"from ledgerline.{domain} import {m}" for m in picks]
    body += ["", "", f"class {domain.title().replace('_', '')}SmokeTest(unittest.TestCase):"]
    for m in picks:
        cls = [ln.split()[1].split(":")[0] for ln in (ROOT / f"ledgerline/{domain}/{m}.py").read_text().splitlines()
               if ln.startswith("class ") and not ln.split()[1].endswith("Record:")][0]
        body += [f"    def test_{m}(self):", f"        svc = {m}.{cls}()", "        self.assertEqual(svc.count(), 0)", ""]
    write(f"tests/test_{domain}.py", "\n".join(body))

print(f"ledgerline: {count} filler modules")
