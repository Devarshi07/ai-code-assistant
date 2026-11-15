"""Text rendering used by the level editor preview and the CLI."""
from .geometry import direction_between
from .level import FLOOR

PATH_MARK = "o"


def render(level, path=None):
    """Return the level as text with floor tiles on path marked."""
    grid = [list(row) for row in level.rows]
    for pos in path or []:
        if grid[pos.row][pos.col] == FLOOR:
            grid[pos.row][pos.col] = PATH_MARK
    return "\n".join("".join(row) for row in grid)


def to_moves(path):
    """Describe a path as compass letters, e.g. 'EESSW'."""
    return "".join(direction_between(a, b) for a, b in zip(path, path[1:]))


def summary(level, run):
    if run is None:
        return f"{level.name}: no route"
    return f"{level.name}: {run.moves} moves  {to_moves(run.path)}"
