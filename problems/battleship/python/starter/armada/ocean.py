"""The ocean grid: coordinates, bounds and the A1-style labels used in logs.

Rows are lettered from the top (A, B, C, ...) and columns are numbered from 1,
so the corners of the standard 10x10 board are A1, A10, J1 and J10.
Internally everything is zero-based: Coord(0, 0) is A1 and Coord(1, 6) is B7.
"""
import re
from typing import Iterator, List, NamedTuple

MIN_SIZE, MAX_SIZE = 4, 26  # one letter per row

_LABEL = re.compile(r"^\s*([A-Za-z])\s*(\d{1,2})\s*$")


class OffBoardError(ValueError):
    """Raised when a shot or a lookup falls outside the ocean."""


class Coord(NamedTuple):
    row: int
    col: int

    def __str__(self):
        if self.row < 0 or self.col < 0:
            return f"({self.row}, {self.col})"
        return f"{chr(ord('A') + self.row)}{self.col + 1}"


def parse_label(text: str) -> Coord:
    """'B7' -> Coord(1, 6). Case and surrounding spaces are ignored."""
    match = _LABEL.match(text)
    if not match:
        raise ValueError(f"not a board label: {text!r}")
    letter, number = match.groups()
    return Coord(ord(letter.upper()) - ord("A"), int(number) - 1)


def to_coord(value) -> Coord:
    """Accept a Coord, a (row, col) pair or a label such as 'B7'."""
    if isinstance(value, str):
        return parse_label(value)
    row, col = value
    return Coord(int(row), int(col))


class Ocean:
    """A square board of size x size cells."""

    def __init__(self, size: int = 10):
        if not MIN_SIZE <= size <= MAX_SIZE:
            raise ValueError(f"board size must be between {MIN_SIZE} and {MAX_SIZE}, got {size}")
        self.size = size

    def in_bounds(self, coord: Coord) -> bool:
        return 0 <= coord.row < self.size and 0 <= coord.col < self.size

    def require(self, value) -> Coord:
        """Normalise value to a Coord, raising OffBoardError if it is not on this board."""
        coord = to_coord(value)
        if not self.in_bounds(coord):
            raise OffBoardError(f"{coord} is off the {self.size}x{self.size} board")
        return coord

    def cells(self) -> Iterator[Coord]:
        """Every cell, row by row from A1."""
        for row in range(self.size):
            for col in range(self.size):
                yield Coord(row, col)

    def neighbours(self, coord: Coord) -> List[Coord]:
        """The on-board cells directly north, south, west and east of coord."""
        around = [Coord(coord.row - 1, coord.col), Coord(coord.row + 1, coord.col),
                  Coord(coord.row, coord.col - 1), Coord(coord.row, coord.col + 1)]
        return [c for c in around if self.in_bounds(c)]

    def render(self, mark) -> str:
        """Draw the board as text, calling mark(coord) for each cell's character."""
        lines = ["   " + "".join(f"{col + 1:>3}" for col in range(self.size))]
        for row in range(self.size):
            cells = "".join(f"{mark(Coord(row, col)):>3}" for col in range(self.size))
            lines.append(f" {chr(ord('A') + row)} {cells}")
        return "\n".join(lines)
