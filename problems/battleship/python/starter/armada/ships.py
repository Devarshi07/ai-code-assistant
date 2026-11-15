"""Ship models and fleet placement.

A Fleet owns the ships on one ocean and enforces the placement rules: every
ship is a straight horizontal or vertical line, stays on the board and never
shares a cell with another ship. Ships may touch side by side (studio rules).
"""
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .ocean import Coord, Ocean, to_coord

# Ship lengths of the standard fleet: carrier, battleship, cruiser, submarine, destroyer.
DEFAULT_FLEET = (5, 4, 3, 3, 2)

# Class names by length. A repeated length takes the next name on its list.
CLASS_NAMES = {5: ["Carrier"], 4: ["Battleship"], 3: ["Cruiser", "Submarine"],
               2: ["Destroyer"], 1: ["Patrol boat"]}


class PlacementError(ValueError):
    """Raised when a ship cannot be placed where requested."""


@dataclass(eq=False)
class Ship:
    name: str
    cells: Tuple[Coord, ...]
    damage: int = 0  # hits taken so far in the current battle

    @property
    def size(self) -> int:
        return len(self.cells)

    @property
    def is_sunk(self) -> bool:
        return self.damage >= self.size

    def take_hit(self):
        self.damage += 1


class Fleet:
    """The ships hidden on one ocean."""

    def __init__(self, ocean: Ocean):
        self.ocean = ocean
        self.ships: List[Ship] = []
        self._by_cell: Dict[Coord, Ship] = {}

    @staticmethod
    def span(length, origin, vertical) -> Tuple[Coord, ...]:
        """The cells a ship of this length covers, starting at origin."""
        if vertical:
            return tuple(Coord(origin.row + i, origin.col) for i in range(length))
        return tuple(Coord(origin.row, origin.col + i) for i in range(length))

    def fits(self, length, origin, vertical=False) -> bool:
        cells = self.span(length, to_coord(origin), vertical)
        return all(self.ocean.in_bounds(c) and c not in self._by_cell for c in cells)

    def place(self, length, origin, vertical=False, name=None) -> Ship:
        """Add a ship whose bow is at origin, running east (or south if vertical)."""
        if length < 1:
            raise PlacementError(f"a ship needs at least one cell, got {length}")
        origin = to_coord(origin)
        if name is None:
            names = CLASS_NAMES.get(length, [f"{length}-cell ship"])
            taken = sum(1 for ship in self.ships if ship.size == length)
            name = names[taken] if taken < len(names) else f"{names[-1]} {taken + 1}"
        cells = self.span(length, origin, vertical)
        for cell in cells:
            if not self.ocean.in_bounds(cell):
                raise PlacementError(f"{name} at {origin} runs off the board")
            if cell in self._by_cell:
                raise PlacementError(f"{name} at {origin} overlaps the {self._by_cell[cell].name} at {cell}")
        ship = Ship(name, cells)
        self.ships.append(ship)
        for cell in cells:
            self._by_cell[cell] = ship
        return ship

    def ship_at(self, coord) -> Optional[Ship]:
        return self._by_cell.get(to_coord(coord))

    @property
    def ship_sizes(self) -> Tuple[int, ...]:
        return tuple(ship.size for ship in self.ships)

    def reset_damage(self):
        for ship in self.ships:
            ship.damage = 0

    def render(self) -> str:
        """The fleet as a chart: ships are lettered A, B, C... in placement order."""
        letters = {id(ship): chr(ord("A") + i) for i, ship in enumerate(self.ships)}
        return self.ocean.render(lambda c: letters[id(self._by_cell[c])] if c in self._by_cell else ".")
