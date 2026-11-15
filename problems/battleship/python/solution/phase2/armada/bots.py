"""Bots that play matches. See "Writing a bot" in README.md for the contract."""
from .battle import ShotResult
from .ocean import Coord, Ocean, to_coord
from .ships import DEFAULT_FLEET


class BotError(RuntimeError):
    """Raised when a bot has no legal shot left to offer."""


class Bot:
    """Base class for match bots.

    A fresh bot is created for every match with the board size and the ship
    lengths in the fleet: the fleet's make-up is public, its positions are not.
    The match runner then calls next_shot() and observe(coord, result) in turn
    until the fleet is sunk or the shot budget is spent.
    """

    def __init__(self, size: int, ship_sizes=DEFAULT_FLEET):
        self.size = size
        self.ship_sizes = tuple(ship_sizes)

    def next_shot(self) -> Coord:
        raise NotImplementedError

    def observe(self, coord: Coord, result: ShotResult) -> None:
        """Called once after every shot with the cell and its outcome."""


class ScriptedBot(Bot):
    """Fires a fixed list of shots in order. QA uses it to replay bug reports."""

    def __init__(self, size, shots, ship_sizes=DEFAULT_FLEET):
        super().__init__(size, ship_sizes)
        self.script = [to_coord(shot) for shot in shots]
        self._cursor = 0

    def next_shot(self) -> Coord:
        if self._cursor >= len(self.script):
            raise BotError(f"script exhausted after {len(self.script)} shots")
        self._cursor += 1
        return self.script[self._cursor - 1]


class SeekerBot(Bot):
    """The studio's reference opponent: finds and sinks a hidden fleet.

    Sweeps the board row by row from A1. Every cell is tried exactly once, so
    the fleet is always sunk within size * size shots and nothing repeats.
    """

    def __init__(self, size, ship_sizes=DEFAULT_FLEET):
        super().__init__(size, ship_sizes)
        self._queue = list(Ocean(size).cells())
        self._cursor = 0

    def next_shot(self) -> Coord:
        if self._cursor >= len(self._queue):
            raise BotError("every cell has already been fired at")
        self._cursor += 1
        return self._queue[self._cursor - 1]

    def observe(self, coord, result):
        pass  # a sweep does not need the outcome
