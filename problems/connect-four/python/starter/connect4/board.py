"""Board model for Connect Four.

The board is stored column by column with row 0 at the bottom, because discs
fall: each column is a stack. In code, columns are numbered from 0 (leftmost).
Players see them numbered from 1, and move strings use the players' numbers:
"4453" means the 4th, 4th, 5th and 3rd columns from the left.

The board knows nothing about winning; see rules.py for that. It will happily
keep accepting discs after someone has connected four, which is what the
search code wants when it plays moves out and takes them back.
"""

EMPTY = "."
RED = "R"       # Red always moves first
YELLOW = "Y"
NAMES = {RED: "Red", YELLOW: "Yellow"}


def other(player):
    """The opponent of player."""
    return YELLOW if player == RED else RED


class BoardError(ValueError):
    """Raised for illegal moves and malformed positions."""


class Board:
    def __init__(self, columns=7, rows=6):
        if columns < 4 or rows < 4:
            raise BoardError(f"a {columns}x{rows} board is too small for four in a row")
        self.columns = columns
        self.rows = rows
        self._cells = [[EMPTY] * rows for _ in range(columns)]
        self._heights = [0] * columns
        self._history = []
        self._discs = 0

    # -- construction and serialisation --------------------------------

    @classmethod
    def from_moves(cls, moves, columns=7, rows=6):
        """Replay a move string such as "4453" (1-based columns, Red first)."""
        board = cls(columns, rows)
        for index, symbol in enumerate(moves.replace(" ", "")):
            if not symbol.isdigit() or not 1 <= int(symbol) <= columns:
                raise BoardError(f"move {index + 1}: {symbol!r} is not a column from 1 to {columns}")
            board.drop(int(symbol) - 1)
        return board

    @classmethod
    def from_grid(cls, text):
        """Parse a position drawn top row first, as in puzzle files and bug reports.

        Each non-blank line is one row; spaces and '|' borders are ignored.
        The side to move follows from the disc counts (Red moves first).
        Loaded boards have no history, so undo() stops at the loaded position.
        """
        lines = [line.replace(" ", "").strip("|") for line in text.strip("\n").splitlines()]
        grid = [line for line in lines if line]
        if not grid:
            raise BoardError("grid is empty")
        width = len(grid[0])
        if any(len(line) != width for line in grid):
            raise BoardError("every row of the grid must have the same width")
        board = cls(width, len(grid))
        for col in range(board.columns):
            for row in range(board.rows):
                symbol = grid[board.rows - 1 - row][col]
                if symbol not in (EMPTY, RED, YELLOW):
                    raise BoardError(f"unknown symbol {symbol!r} in the grid")
                if symbol == EMPTY:
                    continue
                if board._heights[col] != row:
                    raise BoardError(f"column {col + 1} has a floating disc")
                board._cells[col][row] = symbol
                board._heights[col] += 1
                board._discs += 1
        reds = sum(column.count(RED) for column in board._cells)
        yellows = board._discs - reds
        if reds - yellows not in (0, 1):
            raise BoardError(f"impossible position: {reds} red discs and {yellows} yellow")
        return board

    def to_moves(self):
        """The moves played on this board object, as a 1-based move string."""
        return "".join(str(col + 1) for col in self._history)

    def to_grid(self):
        """The position as text, top row first: the format from_grid reads."""
        return "\n".join(
            "".join(self._cells[col][row] for col in range(self.columns))
            for row in reversed(range(self.rows))
        )

    def copy(self):
        clone = Board(self.columns, self.rows)
        clone._cells = [column[:] for column in self._cells]
        clone._heights = self._heights[:]
        clone._history = self._history[:]
        clone._discs = self._discs
        return clone

    # -- queries ---------------------------------------------------------

    @property
    def to_move(self):
        """The player whose disc goes in next."""
        return RED if self._discs % 2 == 0 else YELLOW

    @property
    def move_count(self):
        """Discs on the board."""
        return self._discs

    def in_bounds(self, col, row):
        return 0 <= col < self.columns and 0 <= row < self.rows

    def cell(self, col, row):
        return self._cells[col][row]

    def height(self, col):
        """Number of discs in a column; also the row the next disc lands on."""
        return self._heights[col]

    def can_play(self, col):
        return 0 <= col < self.columns and self._heights[col] < self.rows

    def legal_moves(self):
        return [col for col in range(self.columns) if self._heights[col] < self.rows]

    def is_full(self):
        return self._discs == self.columns * self.rows

    # -- changes ---------------------------------------------------------

    def drop(self, col):
        """Drop the side to move's disc into col and return the row it lands on."""
        if not 0 <= col < self.columns:
            raise BoardError(f"there is no column {col}")
        row = self._heights[col]
        if row >= self.rows:
            raise BoardError(f"column {col + 1} is full")
        self._cells[col][row] = self.to_move
        self._heights[col] = row + 1
        self._discs += 1
        self._history.append(col)
        return row

    def undo(self):
        """Take back the most recent drop and return its column."""
        if not self._history:
            raise BoardError("there is no move to undo")
        col = self._history.pop()
        self._heights[col] -= 1
        self._cells[col][self._heights[col]] = EMPTY
        self._discs -= 1
        return col

    def __repr__(self):
        return f"Board({self.columns}x{self.rows}, {self._discs} discs, {self.to_move} to move)"
