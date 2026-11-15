"""Plain-text rendering for the CLI, server logs and bug reports."""


def render(board, highlight=()):
    """The board as text, top row first, with the players' column numbers below.

    Discs whose (col, row) is in highlight, such as a winning line, are drawn
    in lowercase so they stand out in a terminal.
    """
    marked = set(highlight)
    lines = []
    for row in reversed(range(board.rows)):
        cells = []
        for col in range(board.columns):
            disc = board.cell(col, row)
            cells.append(disc.lower() if (col, row) in marked else disc)
        lines.append("| " + " ".join(cells) + " |")
    lines.append("+" + "-" * (2 * board.columns + 1) + "+")
    lines.append("  " + " ".join(str(col + 1) for col in range(board.columns)))
    return "\n".join(lines)


def render_game(game):
    """The board with any winning line highlighted, followed by the status."""
    return render(game.board, game.winning_cells or ()) + "\n" + game.status


def describe_move(col):
    """A column as players say it: describe_move(3) == "column 4"."""
    return f"column {col + 1}"
