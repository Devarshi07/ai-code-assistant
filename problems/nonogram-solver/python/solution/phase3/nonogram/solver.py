"""Solver used by the import pipeline to build answer keys for contributor puzzles.

Constraint propagation with a fallback search:

1. Line solving. For one row or column, a dynamic program finds every cell
   that has the same value in *all* placements of the clue that agree with
   the cells already known. That costs O(length * blocks) per line instead
   of enumerating placements.
2. Propagation. Lines are solved from a work queue; whenever a cell is
   settled, the crossing line is queued again. This runs to a fixpoint.
3. Search. If cells are still unknown at the fixpoint, guess one, propagate,
   and back out of the guess on contradiction.
"""
from collections import deque

from .model import EMPTY, FILLED

UNKNOWN = -1


def solve_line(clue, cells):
    """Settle every forced cell of one line.

    cells holds FILLED, EMPTY or UNKNOWN. Returns a new list in which each
    UNKNOWN cell that is the same in every consistent placement is set, or
    None when no placement of clue agrees with the known cells.
    """
    n, k = len(cells), len(clue)
    empties = [0] * (n + 1)  # empties[i]: known-empty cells in cells[:i]
    fills = [0] * (n + 1)
    for i, cell in enumerate(cells):
        empties[i + 1] = empties[i] + (cell == EMPTY)
        fills[i + 1] = fills[i] + (cell == FILLED)

    # fwd[j][i]: cells[:i] can hold exactly the first j blocks.
    fwd = [[False] * (n + 1) for _ in range(k + 1)]
    for i in range(n + 1):
        if fills[i]:
            break
        fwd[0][i] = True
    for j in range(1, k + 1):
        size, row, prev = clue[j - 1], fwd[j], fwd[j - 1]
        for i in range(size, n + 1):
            ok = row[i - 1] and cells[i - 1] != FILLED          # cell i-1 left empty
            if not ok and empties[i] == empties[i - size]:       # block j ends at i
                s = i - size
                ok = prev[s] if j == 1 else s >= 1 and cells[s - 1] != FILLED and prev[s - 1]
            row[i] = ok
    if not fwd[k][n]:
        return None

    # bwd[j][i]: cells[i:] can hold exactly blocks j.. (last one included).
    bwd = [[False] * (n + 2) for _ in range(k + 1)]
    for i in range(n, -1, -1):
        if fills[n] - fills[i]:
            break
        bwd[k][i] = True
    for j in range(k - 1, -1, -1):
        size, row, nxt = clue[j], bwd[j], bwd[j + 1]
        for i in range(n - size, -1, -1):
            ok = row[i + 1] and cells[i] != FILLED              # cell i left empty
            if not ok and empties[i + size] == empties[i]:       # block j starts at i
                e = i + size
                ok = nxt[e] if j == k - 1 else e < n and cells[e] != FILLED and nxt[e + 1]
            row[i] = ok

    # A block can sit at [s, e) if the prefix fits the earlier blocks and the
    # suffix fits the later ones; mark the covered cells with a difference array.
    cover = [0] * (n + 1)
    for j in range(k):
        size, left, right = clue[j], fwd[j], bwd[j + 1]
        for s in range(n - size + 1):
            e = s + size
            if empties[e] != empties[s]:
                continue
            if j == 0:
                if not left[s]:
                    continue
            elif s < 1 or cells[s - 1] == FILLED or not left[s - 1]:
                continue
            if j == k - 1:
                if not right[e]:
                    continue
            elif e >= n or cells[e] == FILLED or not right[e + 1]:
                continue
            cover[s] += 1
            cover[e] -= 1

    settled = list(cells)
    covered = 0
    for i in range(n):
        covered += cover[i]
        if cells[i] != UNKNOWN:
            continue
        can_be_empty = any(fwd[j][i] and bwd[j][i + 1] for j in range(k + 1))
        if covered and not can_be_empty:
            settled[i] = FILLED
        elif can_be_empty and not covered:
            settled[i] = EMPTY
        elif not covered:
            return None
    return settled


def _propagate(puzzle, grid, rows, cols):
    """Solve lines until nothing changes. Returns False on a contradiction."""
    width, height = puzzle.width, puzzle.height
    queue = deque([(True, r) for r in rows] + [(False, c) for c in cols])
    row_queued = [False] * height
    col_queued = [False] * width
    for r in rows:
        row_queued[r] = True
    for c in cols:
        col_queued[c] = True
    while queue:
        is_row, index = queue.popleft()
        if is_row:
            row_queued[index] = False
            line = grid[index]
            settled = solve_line(puzzle.row_clues[index], line)
            if settled is None:
                return False
            for c in range(width):
                if settled[c] != line[c]:
                    line[c] = settled[c]
                    if not col_queued[c]:
                        col_queued[c] = True
                        queue.append((False, c))
        else:
            col_queued[index] = False
            line = [grid[r][index] for r in range(height)]
            settled = solve_line(puzzle.col_clues[index], line)
            if settled is None:
                return False
            for r in range(height):
                if settled[r] != line[r]:
                    grid[r][index] = settled[r]
                    if not row_queued[r]:
                        row_queued[r] = True
                        queue.append((True, r))
    return True


def _search(puzzle, grid, rows, cols):
    if not _propagate(puzzle, grid, rows, cols):
        return None
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell == UNKNOWN:
                for value in (FILLED, EMPTY):
                    trial = [line[:] for line in grid]
                    trial[r][c] = value
                    found = _search(puzzle, trial, [r], [c])
                    if found is not None:
                        return found
                return None
    return grid


def solve(puzzle):
    """Return a grid that satisfies every row and column clue of puzzle.

    The grid is a list of puzzle.height rows, each a list of puzzle.width
    cells (FILLED or EMPTY). Returns None when no grid fits the clues.
    """
    grid = [[UNKNOWN] * puzzle.width for _ in range(puzzle.height)]
    return _search(puzzle, grid, range(puzzle.height), range(puzzle.width))
