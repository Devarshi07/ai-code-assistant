"""The computer opponent and the puzzle checker.

choose_move() powers "Play the computer". solve() checks the daily puzzles
("Red to play and win in 5"): it finds how quickly the side to move can force
a win. Distances are counted in plies. A ply is one disc dropped by either
player, so a win in 5 plies means three discs from the winner and two from
the defender, the last of the three completing the four.
"""
from typing import NamedTuple, Optional

from .board import other
from .rules import AXES

DEFAULT_DEPTH = 4
WIN_SCORE = 1_000_000   # far above anything evaluate() can return

# Heuristic points for a window of four cells that holds discs of one player
# only, keyed by how many of that player's discs it holds.
WINDOW_POINTS = {2: 2, 3: 5}
CENTRE_POINTS = 3


class ForcedWin(NamedTuple):
    move: int    # 0-based column to play now
    plies: int   # plies until the four is completed, counting both sides; 1 = wins at once


def centre_order(columns):
    """Columns from the centre outwards, left before right: 7 -> [3, 2, 4, 1, 5, 0, 6]."""
    middle = (columns - 1) / 2
    return sorted(range(columns), key=lambda col: (abs(col - middle), col))


_windows = {}


def windows(columns, rows):
    """Every straight line of four cells on a board of this size, as (col, row) lists."""
    key = (columns, rows)
    if key not in _windows:
        found = []
        for dc, dr in AXES:
            for col in range(columns):
                for row in range(rows):
                    end_col, end_row = col + 3 * dc, row + 3 * dr
                    if 0 <= end_col < columns and 0 <= end_row < rows:
                        found.append([(col + i * dc, row + i * dr) for i in range(4)])
        _windows[key] = found
    return _windows[key]


def evaluate(board, player):
    """Static score of a position from player's point of view. Positive is good.

    Rewards windows of four that only player could still complete, penalises
    the opponent's in the same way, and prefers discs in the centre column.
    Symmetric by construction: evaluate(b, p) == -evaluate(b, other(p)).
    Only meaningful for positions that do not already contain a four.
    """
    opponent = other(player)
    score = 0
    for window in windows(board.columns, board.rows):
        mine = theirs = 0
        for col, row in window:
            disc = board.cell(col, row)
            if disc == player:
                mine += 1
            elif disc == opponent:
                theirs += 1
        if theirs == 0:
            score += WINDOW_POINTS.get(mine, 0)
        elif mine == 0:
            score -= WINDOW_POINTS.get(theirs, 0)
    if board.columns % 2:
        centre = board.columns // 2
        for row in range(board.height(centre)):
            score += CENTRE_POINTS if board.cell(centre, row) == player else -CENTRE_POINTS
    return score


def choose_move(board, depth=DEFAULT_DEPTH) -> int:
    """Pick a 0-based column for the side to move.

    Wins at once if it can, otherwise blocks a column where the opponent
    would win next turn, otherwise looks depth plies ahead with minimax and
    scores the positions it reaches with evaluate().
    """
    raise NotImplementedError("Phase 2: choose_move is not implemented yet")


def solve(board, max_plies) -> Optional[ForcedWin]:
    """Fastest forced win for the side to move within max_plies plies, or None."""
    raise NotImplementedError("Phase 2: solve is not implemented yet")
