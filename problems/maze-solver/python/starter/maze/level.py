"""Level model: turns a designer's text layout into a queryable grid.

Symbols
    #   wall
    .   floor
    S   start tile (exactly one)
    E   exit tile (exactly one)
    $   gem
    > < ^ v   one-way gates (see Level.moves_from)
"""
from .geometry import DIRECTIONS, GATES, Position, step

WALL = "#"
FLOOR = "."
START = "S"
EXIT = "E"
GEM = "$"
SYMBOLS = set(WALL + FLOOR + START + EXIT + GEM) | set(GATES)


class LevelError(ValueError):
    """Raised when a level layout is malformed."""


class Level:
    def __init__(self, name, rows):
        if not rows or not rows[0]:
            raise LevelError(f"{name}: level is empty")
        width = len(rows[0])
        if any(len(row) != width for row in rows):
            raise LevelError(f"{name}: every row must have the same width")
        unknown = set("".join(rows)) - SYMBOLS
        if unknown:
            raise LevelError(f"{name}: unknown symbols {''.join(sorted(unknown))!r}")
        self.name = name
        self.rows = list(rows)
        self.height = len(rows)
        self.width = width
        self.start = self._find_one(START)
        self.exit = self._find_one(EXIT)
        self.gems = self._find_all(GEM)

    @classmethod
    def parse(cls, text, name="level"):
        """Build a Level from a block of text, ignoring blank edge lines."""
        rows = [line.strip() for line in text.strip("\n").splitlines() if line.strip()]
        return cls(name, rows)

    def _find_all(self, symbol):
        return [Position(r, c)
                for r, line in enumerate(self.rows)
                for c, ch in enumerate(line) if ch == symbol]

    def _find_one(self, symbol):
        found = self._find_all(symbol)
        if len(found) != 1:
            raise LevelError(f"{self.name}: expected exactly one {symbol!r}, found {len(found)}")
        return found[0]

    def in_bounds(self, pos):
        return 0 <= pos.row < self.height and 0 <= pos.col < self.height

    def cell(self, pos):
        return self.rows[pos.row][pos.col]

    def is_walkable(self, pos):
        return self.in_bounds(pos) and self.cell(pos) != WALL

    def moves_from(self, pos):
        """Yield every position reachable in a single step from pos.

        Gates are one-way doors: a gate can only be entered while moving in
        its arrow's direction, and the next step must continue that way.
        """
        here = self.cell(pos)
        allowed = [GATES[here]] if here in GATES else list(DIRECTIONS)
        for direction in allowed:
            nxt = step(pos, direction)
            if not self.is_walkable(nxt):
                continue
            there = self.cell(nxt)
            if there in GATES and GATES[there] != direction:
                continue
            yield nxt

    def __repr__(self):
        return f"Level({self.name!r}, {self.width}x{self.height}, gems={len(self.gems)})"
