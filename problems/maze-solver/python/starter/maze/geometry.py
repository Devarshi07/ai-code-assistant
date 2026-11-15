"""Grid geometry shared by the level model, the solver and the renderer.

Positions are (row, col) with row 0 at the top of the map, matching the way
level files are written.
"""
from typing import NamedTuple


class Position(NamedTuple):
    row: int
    col: int

    def __str__(self):
        return f"({self.row}, {self.col})"


# Compass directions as (row delta, col delta).
DIRECTIONS = {
    "N": (-1, 0),
    "E": (0, 1),
    "S": (1, 0),
    "W": (0, -1),
}

# One-way gate symbols and the single direction each one allows.
GATES = {">": "E", "<": "W", "^": "N", "v": "S"}


def step(pos, direction):
    """Return the neighbouring position one step from pos in direction."""
    dr, dc = DIRECTIONS[direction]
    return Position(pos.row + dr, pos.col + dc)


def direction_between(a, b):
    """Return the compass direction of a single step from a to b."""
    delta = (b.row - a.row, b.col - a.col)
    for name, d in DIRECTIONS.items():
        if d == delta:
            return name
    raise ValueError(f"{a} and {b} are not adjacent")


def manhattan(a, b):
    return abs(a.row - b.row) + abs(a.col - b.col)
