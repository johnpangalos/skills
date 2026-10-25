from dataclasses import dataclass, field
from datetime import date


@dataclass
class Line:
    name: str
    qty: int
    unit_cents: int


@dataclass
class Order:
    id: int
    customer: str
    tax_id: str
    tax_rate: float
    due: date
    lines: list[Line] = field(default_factory=list)
