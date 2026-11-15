"""Writes the test files for Toll Roads With a Pass. Run from this folder: python generator.py"""
import heapq
import random
from pathlib import Path


def solve(n, roads):
    adj = [[] for _ in range(n + 1)]
    for u, v, c in roads:
        adj[u].append((v, c))
        adj[v].append((u, c))
    inf = float("inf")
    dist = [[inf, inf] for _ in range(n + 1)]
    dist[1][0] = 0
    heap = [(0, 1, 0)]
    while heap:
        d, u, used = heapq.heappop(heap)
        if d > dist[u][used]:
            continue
        if u == n:
            return d
        for v, c in adj[u]:
            if d + c < dist[v][used]:
                dist[v][used] = d + c
                heapq.heappush(heap, (d + c, v, used))
            if not used and d + c // 2 < dist[v][1]:
                dist[v][1] = d + c // 2
                heapq.heappush(heap, (d + c // 2, v, 1))
    return -1


def write(index, n, roads):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    lines = [f"{n} {len(roads)}"] + [f"{u} {v} {c}" for u, v, c in roads]
    (tests / f"input{index:02d}.txt").write_text("\n".join(lines) + "\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(n, roads)}\n")


def road(u, v, c):
    return (u, v, c) if rng.random() < 0.5 else (v, u, c)


def random_graph(n, m, low, high):
    """A random spanning tree plus random extra roads."""
    roads = []
    order = list(range(2, n + 1))
    rng.shuffle(order)
    seen = [1]
    for v in order:
        roads.append(road(rng.choice(seen), v, rng.randint(low, high)))
        seen.append(v)
    while len(roads) < m:
        u, v = rng.sample(range(1, n + 1), 2)
        roads.append(road(u, v, rng.randint(low, high)))
    rng.shuffle(roads)
    return roads


def decoy_route(n, extra):
    """Cheap chain 1-2-...-n plus one pricey direct road: halving the direct road wins."""
    roads = [road(i, i + 1, 10) for i in range(1, n)] + [road(1, n, 19 * n)]
    for _ in range(extra):
        u, v = sorted(rng.sample(range(1, n + 1), 2))
        roads.append(road(u, v, 20 * (v - u) + rng.randint(1, 100)))
    rng.shuffle(roads)
    return roads


def long_highway(n, length, shortcuts, branches):
    """A long route from 1 to n with local shortcuts and dead-end side roads; the toll exceeds 2^31."""
    route = [1] + rng.sample(range(2, n), length - 1) + [n]
    roads = [road(route[i], route[i + 1], rng.randint(200000, 10**6)) for i in range(length)]
    for _ in range(shortcuts):
        span = rng.randint(1, 5)
        i = rng.randint(0, length - span)
        roads.append(road(route[i], route[i + span], rng.randint(150000 * span, 10**6)))
    on_route = set(route)
    side = [v for v in range(2, n) if v not in on_route]
    rng.shuffle(side)
    attached = []
    for x in side[:branches]:
        parent = rng.choice(attached) if attached and rng.random() < 0.5 else rng.choice(route)
        roads.append(road(parent, x, rng.randint(1, 10**6)))
        attached.append(x)
    rng.shuffle(roads)
    return roads


def dead_end(n, length, parallel, branches):
    """A long road network from town 1 that never reaches town n, which sits on a small island."""
    route = [1] + rng.sample(range(2, n), length)
    roads = [road(route[i], route[i + 1], rng.randint(1, 10**4)) for i in range(length)]
    for _ in range(parallel):
        i = rng.randrange(length)
        roads.append(road(route[i], route[i + 1], rng.randint(1, 10**4)))
    on_route = set(route)
    side = [v for v in range(2, n) if v not in on_route]
    rng.shuffle(side)
    attached = []
    for x in side[:branches]:
        parent = rng.choice(attached) if attached and rng.random() < 0.5 else rng.choice(route)
        roads.append(road(parent, x, rng.randint(1, 10**4)))
        attached.append(x)
    island = [n] + side[branches:branches + 4]
    for i in range(1, len(island)):
        roads.append(road(island[rng.randrange(i)], island[i], rng.randint(1, 10**4)))
    rng.shuffle(roads)
    return roads


def maze(rows, cols):
    """A grid whose cheap roads snake back and forth between rows; crossing a wall is expensive."""
    roads = []
    for r in range(rows):
        gap = cols - 1 if r % 2 == 0 else 0
        for c in range(cols):
            v = r * cols + c + 1
            if c + 1 < cols:
                roads.append(road(v, v + 1, rng.randint(1, 100)))
            if r + 1 < rows:
                roads.append(road(v, v + cols, rng.randint(1, 100) if c == gap else rng.randint(500000, 10**6)))
    rng.shuffle(roads)
    return roads


rng = random.Random(5521)
write(0, 5, [(1, 2, 30), (2, 3, 20), (3, 5, 25), (1, 5, 101), (2, 4, 7), (4, 5, 70)])
write(1, 4, [(1, 2, 4), (2, 1, 6), (3, 4, 2)])
write(2, 2, [(1, 2, 1)])
write(3, 2, [])
write(4, 4, [(1, 2, 9), (2, 1, 6), (2, 4, 13), (1, 3, 5), (3, 4, 17), (2, 3, 1)])
write(5, 8, random_graph(8, 14, 1, 20))
write(6, 200, random_graph(200, 600, 1, 1000))
write(7, 1000, decoy_route(1000, 2000))
write(8, 2000, random_graph(2000, 6000, 1, 10**6))
write(9, 100000, long_highway(100000, 30000, 15000, 5000))
write(10, 3000, random_graph(3000, 50000, 1, 999))
write(11, 100000, dead_end(100000, 40000, 3000, 15000))
write(12, 150 * 150, maze(150, 150))
print("wrote 13 tests")
