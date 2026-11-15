"""The computer opponent and the puzzle checker.

choose_move() powers "Play the computer". solve() checks the daily puzzles
("Red to play and win in 5"): it finds how quickly the side to move can force
a win. Distances are counted in plies. A ply is one disc dropped by either
player, so a win in 5 plies means three discs from the winner and two from
the defender, the last of the three completing the four.
"""
from typing import NamedTuple, Optional

from .board import RED, other
from .rules import AXES, is_winning_drop, winning_columns

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

    Iterative deepening over odd distances 1, 3, 5, ...: the first distance
    at which a forced win exists is the exact answer. Each step is a yes/no
    search ("can the side to move force a four within n plies?"), which is
    alpha-beta with the narrowest possible window, plus a transposition
    table, centre-first move ordering and forced replies to immediate threats.
    """
    if max_plies < 1 or not board.legal_moves():
        return None
    search = _WinSearch(board.copy())
    for plies in range(1, max_plies + 1, 2):
        move = search.winning_move(plies)
        if move is not None:
            return ForcedWin(move, plies)
    return None


class _WinSearch:
    """Yes/no forced-win search for the player to move on the given board."""

    def __init__(self, board):
        self.board = board
        self.order = centre_order(board.columns)
        # Exact position key, updated as discs are dropped: one base-3 digit per cell.
        self.digit = {}
        for col in range(board.columns):
            for row in range(board.rows):
                index = col * board.rows + row
                self.digit[col, row] = (3 ** index, 2 * 3 ** index)
        self.key = 0
        for col in range(board.columns):
            for row in range(board.height(col)):
                self.key += self._weight(col, row, board.cell(col, row))
        self.proven = {}    # key -> smallest n known to force a win
        self.refuted = {}   # key -> largest n known not to

    def _weight(self, col, row, player):
        red, yellow = self.digit[col, row]
        return red if player == RED else yellow

    def _drop(self, col):
        board = self.board
        player = board.to_move
        row = board.drop(col)
        weight = self._weight(col, row, player)
        self.key += weight
        return weight

    def _undo(self, weight):
        self.board.undo()
        self.key -= weight

    def wins_within(self, plies):
        """Can the side to move force a four within plies plies?"""
        key = self.key
        if self.proven.get(key, plies + 1) <= plies:
            return True
        if self.refuted.get(key, -1) >= plies:
            return False
        result = self.winning_move(plies) is not None
        if result:
            self.proven[key] = plies
        else:
            self.refuted[key] = plies
        return result

    def winning_move(self, plies):
        """A column that forces a four within plies plies, or None."""
        board = self.board
        moves = [col for col in self.order if board.can_play(col)]
        for col in moves:
            if is_winning_drop(board, col):
                return col
        if plies < 3:
            return None
        threats = winning_columns(board, other(board.to_move))
        if len(threats) > 1:
            return None    # only one of them can be blocked
        for col in threats or moves:
            if self._every_reply_loses(col, plies):
                return col
        return None

    def _every_reply_loses(self, col, plies):
        """After dropping into col, does every reply still lose within plies - 1?"""
        board = self.board
        weight = self._drop(col)
        try:
            replies = [reply for reply in self.order if board.can_play(reply)]
            if not replies:
                return False    # the board filled up: a draw
            defender = board.to_move
            for reply in replies:
                if is_winning_drop(board, reply, defender):
                    return False
            threats = winning_columns(board, other(defender))
            if len(threats) > 1:
                return True     # two threats: the defender cannot block both
            for reply in threats or replies:
                reply_weight = self._drop(reply)
                still_winning = self.wins_within(plies - 2)
                self._undo(reply_weight)
                if not still_winning:
                    return False
            return True
        finally:
            self._undo(weight)
