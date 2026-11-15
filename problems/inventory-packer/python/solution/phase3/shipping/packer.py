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

CLOSED = -1   # room value for cartons nothing more may enter, and for unopened slots


class PackingError(ValueError):
    """An item cannot ship in the requested carton type at all."""


class RoomTree:
    """Max segment tree over carton slots, answering "leftmost slot with room >= need".

    Slots are carton positions in opening order. Both set() and leftmost()
    are O(log n), which keeps the bench rule's "earliest carton that fits"
    cheap even with tens of thousands of open cartons.
    """

    def __init__(self, slots):
        size = 1
        while size < max(slots, 1):
            size *= 2
        self.size = size
        self.best = [CLOSED] * (2 * size)

    def set(self, slot, room):
        best = self.best
        node = slot + self.size
        best[node] = room
        node //= 2
        while node:
            top = max(best[2 * node], best[2 * node + 1])
            if best[node] == top:
                break   # nothing above this node changes either
            best[node] = top
            node //= 2

    def leftmost(self, need):
        """Index of the leftmost slot with room >= need, or -1 if none has."""
        best = self.best
        if best[1] < need:
            return -1
        node = 1
        while node < self.size:
            node *= 2
            if best[node] < need:
                node += 1
        return node - self.size


def pack_items(items, carton_type: CartonType) -> List[Carton]:
    """Plan cartons of carton_type for items, following the bench rule.

    Bench rule (first-fit decreasing): take units heaviest first, keeping
    order-line order between equal weights, and put each one into the
    earliest-opened carton that may legally take it. Open a new carton only
    when none can.

    Instead of scanning every open carton per unit, two segment trees track
    how much more each carton may take: one for ordinary units (its current
    limit minus its load) and one for fragile units (the fragile limit minus
    its load). The leftmost slot with enough room is exactly the carton the
    scan would have found, so the plan is identical, in O(n log n).

    Returns the cartons in the order they are opened, numbered from 1.
    Raises PackingError if some item cannot ship in carton_type even on its own.
    """
    for item in items:
        check_shippable(item, carton_type)
    fragile_limit = carton_type.fragile_max_weight_g
    ordinary_room = RoomTree(len(items))
    fragile_room = RoomTree(len(items))
    cartons = []
    for item in sorted(items, key=lambda unit: -unit.weight_g):
        slot = -1
        if not item.hazmat:
            tree = fragile_room if item.fragile else ordinary_room
            slot = tree.leftmost(item.weight_g)
        if slot < 0:
            slot = len(cartons)
            cartons.append(Carton(carton_type, slot + 1))
        carton = cartons[slot]
        carton.add(item)
        if carton.hazmat:
            ordinary_room.set(slot, CLOSED)
            fragile_room.set(slot, CLOSED)
        else:
            ordinary_room.set(slot, carton.limit_g - carton.weight_g)
            fragile_room.set(slot, fragile_limit - carton.weight_g)
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
