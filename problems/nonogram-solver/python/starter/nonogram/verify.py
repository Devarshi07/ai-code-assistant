"""Answer checking: is a player's (or the solver's) grid a solution?"""
from typing import List, NamedTuple

from .clues import line_clue
from .model import EMPTY, FILLED, PuzzleError, columns, format_clue


class Mismatch(NamedTuple):
    """One line whose cells do not produce its clue."""
    kind: str            # "row" or "column"
    index: int           # 0-based
    expected: List[int]  # the puzzle's clue
    actual: List[int]    # the clue the grid's cells produce

    def __str__(self):
        return (f"{self.kind} {self.index + 1}: clue is {format_clue(self.expected)}, "
                f"grid gives {format_clue(self.actual)}")


def check_shape(puzzle, grid):
    """Raise PuzzleError unless grid is height x width and every cell is FILLED or EMPTY."""
    if len(grid) != puzzle.height or any(len(row) != puzzle.width for row in grid):
        raise PuzzleError(f"{puzzle.title}: grid must be {puzzle.width}x{puzzle.height}")
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell not in (FILLED, EMPTY):
                raise PuzzleError(f"{puzzle.title}: cell ({r}, {c}) is {cell!r}, not filled or empty")


def find_mismatches(puzzle, grid):
    """Every row and column of grid that disagrees with puzzle's clues."""
    check_shape(puzzle, grid)
    problems = []
    for r, row in enumerate(grid):
        actual = line_clue(row)
        if actual != puzzle.row_clues[r]:
            problems.append(Mismatch("row", r, puzzle.row_clues[r], actual))
    for c, col in enumerate(columns(grid)):
        actual = line_clue(col)
        if actual != puzzle.col_clues[c]:
            problems.append(Mismatch("column", c, puzzle.col_clues[c], actual))
    return problems


def is_solution(puzzle, grid):
    """True when grid has the puzzle's shape and matches every clue."""
    try:
        return not find_mismatches(puzzle, grid)
    except PuzzleError:
        return False
