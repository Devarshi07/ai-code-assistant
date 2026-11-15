"""Catalogue items and customer orders."""
from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class Item:
    """One sellable unit as listed in the catalogue.

    weight_g is the packed weight of a single unit, in whole grams.
    fragile items need padding, which lowers the load a carton may carry.
    hazmat items (batteries, aerosols, solvents) ship in a carton of their own.
    """
    sku: str
    description: str
    weight_g: int
    fragile: bool = False
    hazmat: bool = False

    def __post_init__(self):
        if not self.sku:
            raise ValueError("an item needs a SKU")
        if not isinstance(self.weight_g, int) or self.weight_g < 1:
            raise ValueError(f"{self.sku}: weight must be a whole number of grams, at least 1")

    @property
    def flags(self):
        return [name for name, on in (("fragile", self.fragile), ("hazmat", self.hazmat)) if on]


@dataclass
class OrderLine:
    item: Item
    quantity: int

    @property
    def weight_g(self):
        return self.item.weight_g * self.quantity


@dataclass
class Order:
    order_id: str
    lines: List[OrderLine] = field(default_factory=list)

    def units(self) -> List[Item]:
        """One entry per physical unit to pack, in order-line order."""
        return [line.item for line in self.lines for _ in range(line.quantity)]

    @property
    def unit_count(self):
        return sum(line.quantity for line in self.lines)

    @property
    def total_weight_g(self):
        return sum(line.weight_g for line in self.lines)

    @property
    def has_fragile(self):
        return any(line.item.fragile for line in self.lines)

    @property
    def has_hazmat(self):
        return any(line.item.hazmat for line in self.lines)
