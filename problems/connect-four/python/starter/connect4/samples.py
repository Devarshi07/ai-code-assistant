"""Sample games and puzzles used by the demo and by the support team."""
from typing import NamedTuple

from .board import Board

# Move log attached to support ticket #4127. The player says Yellow's last disc
# completed a diagonal running from column 2 down to column 5.
REPORTED_GAME = "453421332272"

# A short opening for the computer-opponent demo.
OPENING = "4453"


class Puzzle(NamedTuple):
    name: str
    moves: str   # how the position arose, as a 1-based move string
    plies: int   # the advertised forced-win distance

    def board(self):
        return Board.from_moves(self.moves)


DAILY_PUZZLES = [
    Puzzle("Monday", "216646", 3),
    Puzzle("Wednesday", "36566312253", 5),
    Puzzle("Friday", "164773774571", 7),
]
