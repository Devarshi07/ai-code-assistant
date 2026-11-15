"""Solver used by the import pipeline to build answer keys for contributor puzzles."""
from .model import EMPTY, FILLED


def line_placements(clue, length):
    """Every way to lay out clue's blocks in a line of `length` cells."""
    if not clue:
        return [[EMPTY] * length]
    first, rest = clue[0], clue[1:]
    tail_min = sum(rest) + len(rest)  # later blocks plus the gap before each
    placements = []
    for start in range(length - tail_min - first + 1):
        head = [EMPTY] * start + [FILLED] * first
        if rest:
            for tail in line_placements(rest, length - len(head) - 1):
                placements.append(head + [EMPTY] + tail)
        else:
            placements.append(head + [EMPTY] * (length - len(head)))
    return placements


def _room_needed(clue):
    """needed[b]: cells required to fit blocks b.. of clue, with gaps between them."""
    needed = [0] * (len(clue) + 1)
    for b in range(len(clue) - 1, -1, -1):
        needed[b] = clue[b] + needed[b + 1] + (1 if b + 1 < len(clue) else 0)
    return needed


def solve(puzzle):
    """Return a grid that satisfies every row and column clue of puzzle.

    The grid is a list of puzzle.height rows, each a list of puzzle.width
    cells (FILLED or EMPTY). Returns None when no grid fits the clues.

    Row-by-row backtracking: try every placement of each row's clue and keep
    a running state per column (blocks finished, length of the open block) so
    a row is rejected as soon as some column prefix can no longer match.
    """
    width, height = puzzle.width, puzzle.height
    col_clues = puzzle.col_clues
    options = [line_placements(clue, width) for clue in puzzle.row_clues]
    needed = [_room_needed(clue) for clue in col_clues]
    grid = []

    def advance(blocks, runs, row, rows_left):
        """Column states after adding row, or None if a column is now impossible."""
        blocks, runs = blocks[:], runs[:]
        for c in range(width):
            clue = col_clues[c]
            b, run = blocks[c], runs[c]
            if row[c] == FILLED:
                run += 1
                if b >= len(clue) or run > clue[b]:
                    return None
            elif run:
                if run != clue[b]:
                    return None
                b, run = b + 1, 0
            if needed[c][b] - run > rows_left:
                return None  # not enough rows left for this column's remaining blocks
            blocks[c], runs[c] = b, run
        return blocks, runs

    def place(r, blocks, runs):
        if r == height:
            return True
        for row in options[r]:
            state = advance(blocks, runs, row, height - r - 1)
            if state is None:
                continue
            grid.append(row)
            if place(r + 1, *state):
                return True
            grid.pop()
        return False

    if place(0, [0] * width, [0] * width):
        return [row[:] for row in grid]
    return None
