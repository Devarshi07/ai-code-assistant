"""Writes the test files for Course Order. Run from this folder: python generator.py"""
import heapq
import random
from pathlib import Path


def solve(n, edges):
    after = [[] for _ in range(n + 1)]
    waiting = [0] * (n + 1)
    for a, b in edges:
        after[a].append(b)
        waiting[b] += 1
    ready = [course for course in range(1, n + 1) if waiting[course] == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        course = heapq.heappop(ready)
        order.append(course)
        for nxt in after[course]:
            waiting[nxt] -= 1
            if waiting[nxt] == 0:
                heapq.heappush(ready, nxt)
    return ' '.join(map(str, order)) if len(order) == n else 'IMPOSSIBLE'


def write(index, n, edges):
    assert 1 <= n <= 10**5 and len(edges) <= 10**5
    assert all(1 <= a <= n and 1 <= b <= n and a != b for a, b in edges)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    lines = [f"{n} {len(edges)}"] + [f"{a} {b}" for a, b in edges]
    (tests / f"input{index:02d}.txt").write_text('\n'.join(lines) + '\n', newline="\n")
    (tests / f"output{index:02d}.txt").write_text(solve(n, edges) + '\n', newline="\n")


def random_dag(n, m):
    """Prerequisite pairs that follow a hidden random ranking of the courses, so they never form a cycle."""
    rank = rng.sample(range(1, n + 1), n)
    edges = []
    for _ in range(m):
        i = rng.randrange(n - 1)
        j = rng.randint(i + 1, min(n - 1, i + 20)) if rng.random() < 0.5 else rng.randint(i + 1, n - 1)
        edges.append((rank[i], rank[j]))
    return rank, edges


rng = random.Random(2026)
write(0, 5, [(3, 1), (2, 1), (4, 5), (3, 2)])
write(1, 3, [(1, 2), (2, 3), (3, 1)])
write(2, 1, [])
write(3, 6, [])
write(4, 4, [(2, 1), (4, 3), (2, 1)])
write(5, 7, [(1, 2), (2, 3), (5, 6), (6, 7), (7, 5), (1, 4)])
write(6, 12, random_dag(12, 15)[1])
write(7, 2000, [(course + 1, course) for course in range(1, 2000)])
write(8, 3000, random_dag(3000, 6000)[1])
write(9, 100000, random_dag(100000, 50000)[1])
# A long cycle late in the hidden ranking, so most courses can be ordered before the cycle blocks the rest.
rank, edges = random_dag(100000, 50000)
loop = sorted(rng.sample(range(90000, 100000), 25))
edges += [(rank[a], rank[b]) for a, b in zip(loop, loop[1:])] + [(rank[loop[-1]], rank[loop[0]])]
rng.shuffle(edges)
write(10, 100000, edges)
# Blocks of 100 courses; every course below the top block needs one or two courses from the block above it.
blocks = []
for course in range(1, 40000 - 99):
    first = ((course - 1) // 100 + 1) * 100 + 1
    blocks += [(rng.randint(first, first + 99), course) for _ in range(1 if rng.random() < 0.7 else 2)]
rng.shuffle(blocks)
write(11, 40000, blocks)
star = [(30000, course) for course in range(1, 30000)]
rng.shuffle(star)
write(12, 30000, star)
print("wrote 13 tests")
