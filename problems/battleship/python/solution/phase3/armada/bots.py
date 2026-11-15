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
    """The studio's reference opponent: hunt/target with checkerboard parity.

    Hunt: fire at cells where (row + col) is even. A ship two or more cells
    long always covers one of them, so the hunt finds every such ship with at
    most half the board. The odd cells stay queued behind them as a fallback,
    which covers 1-cell ships and guarantees the bot can always finish.

    Target: a HIT queues the cell's untried neighbours. They are fired at,
    most recent first, before hunting resumes, so a ship is finished off as
    soon as it is found. Leftover neighbours after a SUNK are simply tried
    too: a sunk report doesn't say which hits belonged to the ship, and a
    touching ship may still be hiding behind them.
    """

    def __init__(self, size, ship_sizes=DEFAULT_FLEET):
        super().__init__(size, ship_sizes)
        self._ocean = Ocean(size)
        self._fired = set()
        self._targets = []  # stack of cells next to hits
        cells = list(self._ocean.cells())
        self._hunt = ([c for c in cells if (c.row + c.col) % 2 == 0] +
                      [c for c in cells if (c.row + c.col) % 2 == 1])
        self._cursor = 0

    def next_shot(self) -> Coord:
        while self._targets:
            coord = self._targets.pop()
            if coord not in self._fired:
                return coord
        while self._cursor < len(self._hunt) and self._hunt[self._cursor] in self._fired:
            self._cursor += 1
        if self._cursor == len(self._hunt):
            raise BotError("every cell has already been fired at")
        return self._hunt[self._cursor]

    def observe(self, coord, result):
        coord = Coord(*coord)
        self._fired.add(coord)
        if result is ShotResult.HIT:
            self._targets.extend(n for n in self._ocean.neighbours(coord) if n not in self._fired)
