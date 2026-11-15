"""The computer opponent and the puzzle checker.

choose_move() powers "Play the computer". solve() checks the daily puzzles
("Red to play and win in 5"): it finds how quickly the side to move can force
a win. Distances are counted in plies. A ply is one disc dropped by either
player, so a win in 5 plies means three discs from the winner and two from
the defender, the last of the three completing the four.
"""
from typing import NamedTuple, Optional

from .board import other
from .rules import AXES, is_winning_drop

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


def _ordered_moves(board):
    """Legal columns, centre first."""
    return [col for col in centre_order(board.columns) if board.can_play(col)]


def choose_move(board, depth=DEFAULT_DEPTH) -> int:
    """Pick a 0-based column for the side to move.

    Wins at once if it can, otherwise blocks a column where the opponent
    would win next turn, otherwise looks depth plies ahead with minimax and
    scores the positions it reaches with evaluate().
    """
    moves = _ordered_moves(board)
    if not moves:
        raise ValueError("no legal moves: the board is full")
    me = board.to_move
    for col in moves:
        if is_winning_drop(board, col, me):
            return col
    for col in moves:
        if is_winning_drop(board, col, other(me)):
            return col
    best_col, best_score = moves[0], None
    for col in moves:
        board.drop(col)
        score = -_minimax(board, depth - 1)
        board.undo()
        if best_score is None or score > best_score:
            best_col, best_score = col, score
    return best_col


def _minimax(board, depth):
    """Negamax: the score for the side to move, looking depth plies ahead."""
    me = board.to_move
    if depth <= 0:
        return evaluate(board, me)
    moves = _ordered_moves(board)
    if not moves:
        return 0
    for col in moves:
        if is_winning_drop(board, col, me):
            return WIN_SCORE + depth    # a sooner win leaves more depth, so it scores higher
    best = None
    for col in moves:
        board.drop(col)
        score = -_minimax(board, depth - 1)
        board.undo()
        if best is None or score > best:
            best = score
    return best


def solve(board, max_plies) -> Optional[ForcedWin]:
    """Fastest forced win for the side to move within max_plies plies, or None.

    Plain minimax over every line of play up to max_plies deep. A win completed
    on ply n (counted from this position) scores WIN_SCORE - n, so the best
    score also tells how far away the fastest forced win is.
    """
    if max_plies < 1:
        return None
    moves = _ordered_moves(board)
    for col in moves:
        if is_winning_drop(board, col):
            return ForcedWin(col, 1)
    best_col, best_score = None, 0
    for col in moves:
        board.drop(col)
        score = -_outcome(board, max_plies - 1, 1)
        board.undo()
        if score > best_score:
            best_col, best_score = col, score
    if best_col is None:
        return None
    return ForcedWin(best_col, WIN_SCORE - best_score)


def _outcome(board, depth, ply):
    """Exact minimax score for the side to move, ply plies below the root.

    WIN_SCORE - n if the side to move forces a four on root ply n, the negation
    if the opponent does, and 0 if neither happens within depth more plies.
    """
    if depth <= 0:
        return 0
    moves = _ordered_moves(board)
    if not moves:
        return 0
    for col in moves:
        if is_winning_drop(board, col):
            return WIN_SCORE - (ply + 1)
    best = None
    for col in moves:
        board.drop(col)
        score = -_outcome(board, depth - 1, ply + 1)
        board.undo()
        if best is None or score > best:
            best = score
    return best
