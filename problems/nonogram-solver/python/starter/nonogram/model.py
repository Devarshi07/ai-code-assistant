"""Core data model: puzzles, clues and grids.

A *grid* is a list of rows, each a list of cells, where every cell is FILLED
or EMPTY. A *clue* lists the lengths of the filled blocks in one line, in
order (left to right for rows, top to bottom for columns). A line with no
filled cells has the empty clue [], written ``0`` in puzzle files.
"""

FILLED = 1
EMPTY = 0

# Characters used in picture files and previews.
PICTURE_SYMBOLS = {"#": FILLED, ".": EMPTY}
CELL_CHARS = {FILLED: "#", EMPTY: "."}


class PuzzleError(ValueError):
    """Raised for malformed puzzles, pictures and puzzle files."""


def min_length(clue):
    """Fewest cells that can hold clue: every block plus one gap between blocks."""
    return sum(clue) + max(len(clue) - 1, 0)


def format_clue(clue):
    """Clue as designers write it: '3 1 2', or '0' for an empty line."""
    return " ".join(str(n) for n in clue) if clue else "0"


class Puzzle:
    """Row and column clues for one nonogram, validated on construction."""

    def __init__(self, row_clues, col_clues, title="Untitled", author=None):
        self.title = title
        self.author = author
        self.row_clues = [list(clue) for clue in row_clues]
        self.col_clues = [list(clue) for clue in col_clues]
        self.height = len(self.row_clues)
        self.width = len(self.col_clues)
        self._validate()

    def _validate(self):
        if not self.width or not self.height:
            raise PuzzleError(f"{self.title}: a puzzle needs at least one row and one column")
        for kind, clues, length in (("row", self.row_clues, self.width),
                                    ("column", self.col_clues, self.height)):
            for index, clue in enumerate(clues, start=1):
                if any(not isinstance(n, int) or n <= 0 for n in clue):
                    raise PuzzleError(f"{self.title}: {kind} {index} has a block that is not a positive whole number")
                if min_length(clue) > length:
                    raise PuzzleError(f"{self.title}: {kind} {index} clue {format_clue(clue)} "
                                      f"needs {min_length(clue)} cells but the {kind} has {length}")
        by_rows = sum(map(sum, self.row_clues))
        by_cols = sum(map(sum, self.col_clues))
        if by_rows != by_cols:
            raise PuzzleError(f"{self.title}: row clues fill {by_rows} cells but column clues fill {by_cols}")

    @property
    def filled_cells(self):
        return sum(map(sum, self.row_clues))

    def __repr__(self):
        return f"Puzzle({self.title!r}, {self.width}x{self.height})"


def parse_grid(text):
    """Read a picture drawn with '#' (filled) and '.' (empty), one row per line."""
    rows = [line.strip() for line in text.splitlines() if line.strip()]
    if not rows:
        raise PuzzleError("picture is empty")
    width = len(rows[0])
    grid = []
    for number, line in enumerate(rows, start=1):
        if len(line) != width:
            raise PuzzleError(f"picture row {number} has {len(line)} cells, expected {width}")
        unknown = set(line) - set(PICTURE_SYMBOLS)
        if unknown:
            raise PuzzleError(f"picture row {number} has unknown symbols {''.join(sorted(unknown))!r}")
        grid.append([PICTURE_SYMBOLS[ch] for ch in line])
    return grid


def format_grid(grid):
    """Inverse of parse_grid."""
    return "\n".join("".join(CELL_CHARS[cell] for cell in row) for row in grid)


def columns(grid):
    """The grid's columns, top to bottom, as lists of cells."""
    return [list(column) for column in zip(*grid)]
