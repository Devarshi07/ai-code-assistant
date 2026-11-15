"""Route finding over Level grids."""
from collections import deque
from typing import Dict, List, NamedTuple, Optional

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


def search_from(level, source) -> Dict[Position, Optional[Position]]:
    """BFS from source over the whole level; returns each reachable tile's parent."""
    came_from = {source: None}
    queue = deque([source])
    while queue:
        current = queue.popleft()
        for nxt in level.moves_from(current):
            if nxt not in came_from:
                came_from[nxt] = current
                queue.append(nxt)
    return came_from


def solve(level) -> Optional[Run]:
    """Shortest route from the start tile to the exit, ignoring gems."""
    path = shortest_path(level, level.start, level.exit)
    return None if path is None else Run(path, len(path) - 1)


def collect_all_gems(level) -> Optional[Run]:
    """Shortest route from the start tile to the exit that steps on every gem.

    One BFS per stop gives every directional leg length. A Held-Karp dynamic
    program over subsets of gems then finds the best order in O(2^k * k^2).
    """
    gems = level.gems
    k = len(gems)
    sources = [level.start] + gems
    trees = [search_from(level, s) for s in sources]

    def dist(i, target):
        tree = trees[i]
        if target not in tree:
            return None
        steps, node = 0, target
        while tree[node] is not None:
            node = tree[node]
            steps += 1
        return steps

    # dist_gem[i][j]: source i (0 = start, 1..k = gems) to gem j (0-based).
    dist_gem = [[dist(i, g) for g in gems] for i in range(k + 1)]
    dist_exit = [dist(i, level.exit) for i in range(k + 1)]
    if k == 0:
        return solve(level)

    INF = float("inf")
    full = (1 << k) - 1
    best = [[INF] * k for _ in range(1 << k)]
    parent = [[-1] * k for _ in range(1 << k)]
    for j in range(k):
        d = dist_gem[0][j]
        if d is not None:
            best[1 << j][j] = d
    for mask in range(1, full + 1):
        row = best[mask]
        for last in range(k):
            here = row[last]
            if here == INF:
                continue
            legs = dist_gem[last + 1]
            for nxt in range(k):
                bit = 1 << nxt
                if mask & bit or legs[nxt] is None:
                    continue
                cost = here + legs[nxt]
                if cost < best[mask | bit][nxt]:
                    best[mask | bit][nxt] = cost
                    parent[mask | bit][nxt] = last

    best_total, best_last = INF, -1
    for last in range(k):
        tail = dist_exit[last + 1]
        if tail is not None and best[full][last] + tail < best_total:
            best_total, best_last = best[full][last] + tail, last
    if best_last < 0:
        return None

    order, mask, last = [], full, best_last
    while last >= 0:
        order.append(last)
        mask, last = mask ^ (1 << last), parent[mask][last]
    order.reverse()

    stops = [level.start] + [gems[j] for j in order] + [level.exit]
    indices = [0] + [j + 1 for j in order]
    path = [level.start]
    for index, target in zip(indices, stops[1:]):
        tree = trees[index]
        leg, node = [], target
        while node is not None:
            leg.append(node)
            node = tree[node]
        leg.reverse()
        path.extend(leg[1:])
    return Run(path, len(path) - 1)
