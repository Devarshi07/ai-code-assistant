"""Plans which carton each unit of an order goes into.

Packing rules agreed with the carriers:

1. The contents of a carton weigh at most carton_type.max_weight_g.
2. Once a carton holds a fragile item, its contents weigh at most
   carton_type.fragile_max_weight_g (the padding needs the headroom).
3. A hazmat item ships alone: nothing else goes in its carton.
"""
from typing import List

from .cartons import Carton, CartonType
from .units import format_grams


class PackingError(ValueError):
    """An item cannot ship in the requested carton type at all."""


def pack_items(items, carton_type: CartonType) -> List[Carton]:
    """Plan cartons of carton_type for items, following the bench rule.

    Bench rule (first-fit decreasing): take units heaviest first, keeping
    order-line order between equal weights, and put each one into the
    earliest-opened carton that may legally take it. Open a new carton only
    when none can.

    Returns the cartons in the order they are opened, numbered from 1.
    Raises PackingError if some item cannot ship in carton_type even on its own.
    """
    for item in items:
        check_shippable(item, carton_type)
    cartons = []
    for item in sorted(items, key=lambda unit: -unit.weight_g):
        for carton in cartons:
            if can_take(carton, item):
                break
        else:
            carton = Carton(carton_type, len(cartons) + 1)
            cartons.append(carton)
        carton.add(item)
    return cartons


def can_take(carton, item):
    """True if the packing rules allow item into carton as it stands."""
    if carton.hazmat or item.hazmat:
        return False
    kind = carton.carton_type
    limit = kind.fragile_max_weight_g if carton.fragile or item.fragile else kind.max_weight_g
    return carton.weight_g + item.weight_g <= limit


def check_shippable(item, carton_type):
    """Raise PackingError if item is too heavy for carton_type even alone."""
    limit = carton_type.fragile_max_weight_g if item.fragile else carton_type.max_weight_g
    if item.weight_g > limit:
        raise PackingError(f"{item.sku} weighs {format_grams(item.weight_g)}; a {carton_type.name} "
                           f"takes at most {format_grams(limit)}{' when fragile' if item.fragile else ''}")


def pack_order(order, carton_type: CartonType) -> List[Carton]:
    """Plan cartons for every unit of an order."""
    return pack_items(order.units(), carton_type)
