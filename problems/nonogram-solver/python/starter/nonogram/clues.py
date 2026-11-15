"""Clue derivation: turning a designer's drawing into the puzzle players see."""
from .model import FILLED, Puzzle, columns, parse_grid


def line_clue(cells):
    """Run-length encode one line of a picture.

    Returns the lengths of the filled blocks in order, e.g. the line
    ``.##.#..`` has the clue [2, 1]. An all-empty line has the clue [].
    """
    clue = []
    run = 0
    for cell in cells:
        if cell == FILLED:
            run += 1
        elif run:
            clue.append(run)
            run = 0
    return clue


def clues_from_grid(grid):
    """Return (row_clues, col_clues) for a complete grid."""
    return [line_clue(row) for row in grid], [line_clue(col) for col in columns(grid)]


def puzzle_from_picture(picture, title="Untitled", author=None):
    """Build the puzzle for a drawing, given as picture text or as a grid."""
    grid = parse_grid(picture) if isinstance(picture, str) else picture
    row_clues, col_clues = clues_from_grid(grid)
    return Puzzle(row_clues, col_clues, title=title, author=author)
