"""Plans which carton each unit of an order goes into.

Packing rules agreed with the carriers:

1. The contents of a carton weigh at most carton_type.max_weight_g.
2. Once a carton holds a fragile item, its contents weigh at most
   carton_type.fragile_max_weight_g (the padding needs the headroom).
3. A hazmat item ships alone: nothing else goes in its carton.
"""
from typing import List

from .cartons import Carton, CartonType


class PackingError(ValueError):
    """An item cannot ship in the requested carton type at all."""


def pack_items(items, carton_type: CartonType) -> List[Carton]:
    """Plan cartons of carton_type for items, following the bench rule.

    Returns the cartons in the order they are opened, numbered from 1.
    Raises PackingError if some item cannot ship in carton_type even on its own.
    """
    raise NotImplementedError("Phase 2: pack_items is not implemented yet")


def pack_order(order, carton_type: CartonType) -> List[Carton]:
    """Plan cartons for every unit of an order."""
    return pack_items(order.units(), carton_type)
