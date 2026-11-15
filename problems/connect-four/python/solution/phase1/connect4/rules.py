"""Win detection.

A player wins by connecting four or more of their discs in a straight line:
across, up and down, or along either diagonal. Lines are found by walking
outwards from a single disc, which is all the game needs after each drop.
"""
from .board import EMPTY

# Every line a disc can belong to, as a (column step, row step) pair.
# _run_length walks each axis in both directions from the disc.
AXES = (
    (1, 0),    # horizontal
    (0, 1),    # vertical
    (1, 1),    # diagonal
    (1, -1),   # other diagonal
)


def _run_length(board, col, row, axis, player):
    """Discs of player in an unbroken line through (col, row) along axis.

    The cell (col, row) itself is counted as player's whether or not a disc
    is there yet, so this also answers "what if player dropped here?".
    """
    dc, dr = axis
    length = 1
    for sign in (1, -1):
        c, r = col + sign * dc, row + sign * dr
        while board.in_bounds(c, r) and board.cell(c, r) == player:
            length += 1
            c, r = c + sign * dc, r + sign * dr
    return length


def _line_cells(board, col, row, axis, player):
    """The cells of the unbroken line counted by _run_length, in board order."""
    dc, dr = axis
    cells = [(col, row)]
    for sign in (1, -1):
        c, r = col + sign * dc, row + sign * dr
        while board.in_bounds(c, r) and board.cell(c, r) == player:
            cells.append((c, r))
            c, r = c + sign * dc, r + sign * dr
    return sorted(cells)


def winning_line(board, col, row):
    """Cells of a four-or-longer line through the disc at (col, row), or None."""
    player = board.cell(col, row)
    if player == EMPTY:
        return None
    for axis in AXES:
        if _run_length(board, col, row, axis, player) >= 4:
            return _line_cells(board, col, row, axis, player)
    return None


def is_winning_drop(board, col, player=None):
    """Would dropping player's disc (default: the side to move) into col connect four?

    The board is not changed.
    """
    if not board.can_play(col):
        return False
    player = player or board.to_move
    row = board.height(col)
    return any(_run_length(board, col, row, axis, player) >= 4 for axis in AXES)


def winning_columns(board, player=None):
    """Columns where player (default: the side to move) would connect four right now."""
    player = player or board.to_move
    return [col for col in range(board.columns) if is_winning_drop(board, col, player)]


def find_winner(board):
    """Scan a whole position for a four. Returns (player, cells) or None.

    Used when a position is loaded from a grid and has no move history.
    """
    for col in range(board.columns):
        for row in range(board.height(col)):
            line = winning_line(board, col, row)
            if line:
                return board.cell(col, row), line
    return None
