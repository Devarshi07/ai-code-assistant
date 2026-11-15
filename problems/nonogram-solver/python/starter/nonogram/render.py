"""ASCII previews of puzzles, used by the CLI and in review e-mails.

Column clues are stacked above the board and row clues sit to its left::

          1
        2 4 1 4 2
    1 1 . # . # .
      5 # # # # #
"""
from .model import CELL_CHARS, format_clue

UNKNOWN_CHAR = "?"


def render(puzzle, grid=None):
    """Board with clues. Without a grid every cell shows as '?'."""
    row_labels = [format_clue(clue) for clue in puzzle.row_clues]
    margin = max(len(label) for label in row_labels)
    stacks = [[str(n) for n in clue] or ["0"] for clue in puzzle.col_clues]
    depth = max(len(stack) for stack in stacks)
    cell_width = max(2, 1 + max(len(n) for stack in stacks for n in stack))

    lines = []
    for level in range(depth):
        parts = []
        for stack in stacks:
            offset = depth - len(stack)
            parts.append(stack[level - offset].rjust(cell_width) if level >= offset else " " * cell_width)
        lines.append(" " * margin + "".join(parts))
    for r, label in enumerate(row_labels):
        cells = [CELL_CHARS.get(grid[r][c], UNKNOWN_CHAR) if grid else UNKNOWN_CHAR
                 for c in range(puzzle.width)]
        lines.append(label.rjust(margin) + "".join(ch.rjust(cell_width) for ch in cells))
    return "\n".join(line.rstrip() for line in lines)
