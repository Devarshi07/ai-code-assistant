"""Writes the test files for Island Builder. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(cells):
    parent = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    islands, counts = 0, []
    for r, c in cells:
        if (r, c) not in parent:
            parent[(r, c)] = (r, c)
            islands += 1
            for other in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if other in parent:
                    a, b = find((r, c)), find(other)
                    if a != b:
                        parent[a] = b
                        islands -= 1
        counts.append(islands)
    return counts


def write(index, m, n, cells):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    lines = "".join(f"{r} {c}\n" for r, c in cells)
    (tests / f"input{index:02d}.txt").write_text(f"{m} {n} {len(cells)}\n{lines}", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(" ".join(map(str, solve(cells))) + "\n", newline="\n")


def shuffled(items):
    items = list(items)
    rng.shuffle(items)
    return items


def random_cells(m, n, q):
    return [(rng.randrange(m), rng.randrange(n)) for _ in range(q)]


rng = random.Random(2026)
write(0, 3, 3, [(0, 0), (2, 2), (0, 2), (1, 2), (0, 2), (0, 1)])
write(1, 2, 2, [(0, 0), (1, 1), (0, 1), (1, 0)])
write(2, 1, 1, [(0, 0)])
write(3, 1, 1, [(0, 0)] * 4)
# A single row: every other cell first, then the gaps.
write(4, 1, 1000, shuffled((0, c) for c in range(0, 1000, 2)) + shuffled((0, c) for c in range(1, 1000, 2)))
# A single column in random order, then repeats.
column = shuffled((r, 0) for r in range(1000))
write(5, 1000, 1, column + [rng.choice(column) for _ in range(100)])
# A checkerboard of diagonal-only neighbours, then the remaining squares.
write(6, 40, 40, shuffled((r, c) for r in range(40) for c in range(40) if (r + c) % 2 == 0)
      + shuffled((r, c) for r in range(40) for c in range(40) if (r + c) % 2 == 1))
write(7, 10, 10, random_cells(10, 10, 300))
# The border of the largest grid, corners repeated.
border = [(0, c) for c in range(1000)] + [(999, c) for c in range(1000)] + [(r, 0) for r in range(1, 999)] + [(r, 999) for r in range(1, 999)]
write(8, 1000, 1000, shuffled(border) + [(0, 0), (0, 999), (999, 0), (999, 999)])
write(9, 100, 100, random_cells(100, 100, 10000))
write(10, 1000, 1000, random_cells(1000, 1000, 70000))
write(11, 280, 280, shuffled((r, c) for r in range(280) for c in range(280)))
# Vertical strips joined into one long snake, then cells that bridge neighbouring strips.
strips = shuffled((r, c) for c in range(0, 250, 2) for r in range(250))
ends = [(249 if c // 2 % 2 == 0 else 0, c) for c in range(1, 250, 2)]
bridges = shuffled((r, c) for c in range(1, 250, 2) for r in range(1, 249))
write(12, 250, 250, strips + ends + bridges)
write(13, 1000, 100, random_cells(1000, 100, 50000))
print("wrote 14 tests")
