"""Route finding over Level grids."""
from collections import deque
from itertools import permutations
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
    """Shortest route from the start tile to the exit that steps on every gem.

    Computes the shortest leg between every pair of stops, then tries every
    order of gems. Legs are directional because gates are one-way.
    """
    gems = level.gems
    stops = [level.start] + gems + [level.exit]
    legs = {}
    for a in stops:
        for b in stops:
            if a != b and (a, b) not in legs:
                legs[(a, b)] = shortest_path(level, a, b)

    def leg(a, b):
        return [a] if a == b else legs[(a, b)]

    best_total, best_route = None, None
    for order in permutations(gems):
        route = [level.start, *order, level.exit]
        total = 0
        for a, b in zip(route, route[1:]):
            path = leg(a, b)
            if path is None:
                total = None
                break
            total += len(path) - 1
        if total is not None and (best_total is None or total < best_total):
            best_total, best_route = total, route
    if best_route is None:
        return None
    path = [level.start]
    for a, b in zip(best_route, best_route[1:]):
        path.extend(leg(a, b)[1:])
    return Run(path, len(path) - 1)
