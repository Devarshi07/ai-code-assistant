"""Route finding over Level grids."""
from collections import deque
from typing import List, NamedTuple, Optional

from .geometry import Position


class Run(NamedTuple):
    """A complete route through a level."""
    path: List[Position]   # every tile visited, start and exit inclusive
    moves: int             # number of steps, always len(path) - 1


def shortest_path(level, source, target) -> Optional[List[Position]]:
    """Breadth-first search from source to target.

    Returns the positions from source to target inclusive, or None when the
    target cannot be reached.
    """
    if source == target:
        return [source]
    came_from = {source: None}
    queue = deque([source])
    while queue:
        current = queue.popleft()
        for nxt in level.moves_from(current):
            if nxt in came_from:
                continue
            came_from[nxt] = current
            if nxt == target:
                return _rebuild(came_from, target)
            queue.append(nxt)
    return None


def _rebuild(came_from, target):
    path = [target]
    while came_from[path[-1]] is not None:
        path.append(came_from[path[-1]])
    path.reverse()
    return path


def solve(level) -> Optional[Run]:
    """Shortest route from the start tile to the exit, ignoring gems."""
    path = shortest_path(level, level.start, level.exit)
    return None if path is None else Run(path, len(path) - 1)


def collect_all_gems(level) -> Optional[Run]:
    """Shortest route from the start tile to the exit that steps on every gem."""
    raise NotImplementedError("Phase 2: collect_all_gems is not implemented yet")
