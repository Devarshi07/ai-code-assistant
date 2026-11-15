"""Shot resolution: the referee between a shooter and a hidden fleet.

House rules (also in README.md):

* Every call to fire() is a shot and counts toward shots_fired.
* A shot at a cell that has already been fired at is wasted. It always comes
  back MISS, it is flagged as a repeat in the log, and nothing on the board changes.
* SUNK is reported by the shot that hits the last undamaged cell of a ship.
* Shots off the board raise OffBoardError and are not counted.
"""
from enum import Enum
from typing import List, NamedTuple, Optional

from .ocean import Coord


class ShotResult(Enum):
    MISS = "miss"
    HIT = "hit"
    SUNK = "sunk"


class ShotRecord(NamedTuple):
    coord: Coord
    result: ShotResult
    ship: Optional[str] = None  # name of the ship that was struck, if any
    repeat: bool = False        # True when the cell had already been fired at


class Battle:
    """One fleet under fire. A battle always starts from an undamaged fleet."""

    def __init__(self, fleet):
        self.fleet = fleet
        self.ocean = fleet.ocean
        self.shots_fired = 0
        self.log: List[ShotRecord] = []
        self.misses = set()  # water cells that have been fired at
        self.hits = set()    # ship cells that have been fired at
        fleet.reset_damage()

    @property
    def fleet_sunk(self) -> bool:
        return all(ship.is_sunk for ship in self.fleet.ships)

    @property
    def repeats(self) -> int:
        return sum(1 for record in self.log if record.repeat)

    def fire(self, target) -> ShotResult:
        """Resolve one shot at target (a Coord, a (row, col) pair or a label like 'B7')."""
        coord = self.ocean.require(target)
        self.shots_fired += 1
        if coord in self.misses or coord in self.hits:
            return self._record(coord, ShotResult.MISS, repeat=True)

        ship = self.fleet.ship_at(coord)
        if ship is None:
            self.misses.add(coord)
            return self._record(coord, ShotResult.MISS)

        self.hits.add(coord)
        ship.take_hit()
        result = ShotResult.SUNK if ship.is_sunk else ShotResult.HIT
        return self._record(coord, result, ship=ship.name)

    def _record(self, coord, result, ship=None, repeat=False) -> ShotResult:
        self.log.append(ShotRecord(coord, result, ship, repeat))
        return result

    def chart(self) -> str:
        """The shooter's view: '.' unknown, 'o' miss, 'X' hit, '#' part of a sunk ship."""
        def mark(coord):
            if coord in self.misses:
                return "o"
            if coord in self.hits:
                return "#" if self.fleet.ship_at(coord).is_sunk else "X"
            return "."
        return self.ocean.render(mark)
