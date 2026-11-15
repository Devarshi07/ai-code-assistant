"""Game flow: turns, results and replaying the move logs the app stores."""
from .board import Board, BoardError, NAMES
from .rules import find_winner, winning_line

DRAW = "Draw"


class GameError(Exception):
    """Raised for moves the game does not allow, such as playing after a win."""


class Game:
    """One game of Connect Four: a board plus the result so far."""

    def __init__(self, board=None):
        self.board = board if board is not None else Board()
        found = find_winner(self.board)
        self.winner, self.winning_cells = found if found else (None, None)

    @classmethod
    def from_moves(cls, moves, columns=7, rows=6):
        """Replay a stored move log, e.g. "4453". Fails if a move is illegal."""
        game = cls(Board(columns, rows))
        for index, symbol in enumerate(moves.replace(" ", "")):
            if not symbol.isdigit():
                raise GameError(f"move {index + 1}: {symbol!r} is not a column number")
            try:
                game.play(int(symbol) - 1)
            except (BoardError, GameError) as exc:
                raise GameError(f"move {index + 1} (column {symbol}): {exc}") from exc
        return game

    @classmethod
    def from_grid(cls, text):
        """Load a saved position, e.g. from a puzzle file or a bug report."""
        return cls(Board.from_grid(text))

    @property
    def is_over(self):
        return self.winner is not None or self.board.is_full()

    @property
    def to_move(self):
        """The player to move, or None once the game is over."""
        return None if self.is_over else self.board.to_move

    @property
    def status(self):
        if self.winner is not None:
            return f"{NAMES[self.winner]} wins"
        if self.board.is_full():
            return DRAW
        return f"{NAMES[self.board.to_move]} to move"

    def legal_moves(self):
        return [] if self.is_over else self.board.legal_moves()

    def play(self, col):
        """Drop the current player's disc into col (0-based). Returns the row."""
        if self.is_over:
            raise GameError(f"the game is over: {self.status}")
        player = self.board.to_move
        row = self.board.drop(col)
        line = winning_line(self.board, col, row)
        if line:
            self.winner, self.winning_cells = player, line
        return row

    def undo(self):
        """Take back the last move, reopening the game if it had just been won."""
        col = self.board.undo()
        self.winner = self.winning_cells = None
        return col

    def __repr__(self):
        return f"Game({self.board.to_moves()!r}, {self.status})"
