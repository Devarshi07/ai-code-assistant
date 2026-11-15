"""Carton types stocked at the pack benches, and cartons being filled."""
from dataclasses import dataclass


@dataclass(frozen=True)
class CartonType:
    code: str
    name: str
    max_weight_g: int           # carrier limit for the contents of one carton
    fragile_max_weight_g: int   # lower limit once fragile padding goes in


CARTON_TYPES = {
    "S": CartonType("S", "Small box", 2000, 1500),
    "M": CartonType("M", "Medium box", 5000, 3500),
    "L": CartonType("L", "Large box", 10000, 7000),
}


def carton_type(code):
    try:
        return CARTON_TYPES[code.upper()]
    except KeyError:
        raise KeyError(f"unknown carton type {code!r}; stocked: {', '.join(CARTON_TYPES)}") from None


def smallest_carton_for(weight_g, fragile=False):
    """The smallest stocked carton type that holds weight_g in one carton, or None."""
    for kind in sorted(CARTON_TYPES.values(), key=lambda kind: kind.max_weight_g):
        limit = kind.fragile_max_weight_g if fragile else kind.max_weight_g
        if weight_g <= limit:
            return kind
    return None


class Carton:
    """A carton at the pack bench.

    Carton only keeps the books. Deciding what may go in which carton is the
    packer's job (see packer.py).
    """

    def __init__(self, kind, number):
        self.carton_type = kind
        self.number = number        # 1-based position in the shipment
        self.items = []             # in the order they were packed
        self.weight_g = 0
        self.fragile = False        # holds at least one fragile item
        self.hazmat = False         # holds a hazmat item

    @property
    def limit_g(self):
        """Most the contents may weigh, given what is already inside."""
        if self.fragile:
            return self.carton_type.fragile_max_weight_g
        return self.carton_type.max_weight_g

    @property
    def remaining_g(self):
        return self.limit_g - self.weight_g

    def add(self, item):
        self.items.append(item)
        self.weight_g += item.weight_g
        self.fragile = self.fragile or item.fragile
        self.hazmat = self.hazmat or item.hazmat

    def __repr__(self):
        return f"Carton({self.carton_type.code}#{self.number}, {len(self.items)} items, {self.weight_g} g)"
