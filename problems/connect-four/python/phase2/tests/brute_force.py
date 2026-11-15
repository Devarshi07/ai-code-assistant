"""Independent brute-force checker for forced wins, used by the phase 2 and 3 tests.

It plays every line out on the Board with its own four-in-a-row test, so it
does not rely on rules.py or ai.py.
"""


def completes_four(board, col, player):
    row = board.height(col)
    for dc, dr in ((1, 0), (0, 1), (1, 1), (1, -1)):
        count = 1
        for sign in (1, -1):
            c, r = col + sign * dc, row + sign * dr
            while 0 <= c < board.columns and 0 <= r < board.rows and board.cell(c, r) == player:
                count += 1
                c, r = c + sign * dc, r + sign * dr
        if count >= 4:
            return True
    return False


def open_columns(board):
    return [c for c in range(board.columns) if board.height(c) < board.rows]


def move_forces_win(board, col, plies):
    """Does playing col force a four within plies plies, whatever the reply?"""
    if completes_four(board, col, board.to_move):
        return True
    if plies < 3:
        return False
    board.drop(col)
    try:
        replies = open_columns(board)
        if not replies or any(completes_four(board, r, board.to_move) for r in replies):
            return False
        for reply in replies:
            board.drop(reply)
            ok = can_force_win(board, plies - 2)
            board.undo()
            if not ok:
                return False
        return True
    finally:
        board.undo()


def can_force_win(board, plies):
    return any(move_forces_win(board, col, plies) for col in open_columns(board))
