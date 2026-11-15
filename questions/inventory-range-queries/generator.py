"""Writes the test files for Inventory Range Queries. Run from this folder: python generator.py"""
import random
from pathlib import Path

BLOCK = 512


def solve(stock, operations):
    # Square-root decomposition: per-block totals plus the raw shelves.
    shelves = list(stock)
    blocks = [sum(shelves[i:i + BLOCK]) for i in range(0, len(shelves), BLOCK)]
    answers = []
    for kind, x, y in operations:
        if kind == 1:
            blocks[(x - 1) // BLOCK] += y - shelves[x - 1]
            shelves[x - 1] = y
        else:
            lo, hi = x - 1, y - 1
            first, last = lo // BLOCK, hi // BLOCK
            if first == last:
                answers.append(sum(shelves[lo:hi + 1]))
            else:
                answers.append(sum(shelves[lo:(first + 1) * BLOCK]) + sum(blocks[first + 1:last]) + sum(shelves[last * BLOCK:hi + 1]))
    return answers


def write(index, stock, operations):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    ops = "".join(f"{kind} {x} {y}\n" for kind, x, y in operations)
    (tests / f"input{index:02d}.txt").write_text(f"{len(stock)} {len(operations)}\n{' '.join(map(str, stock))}\n{ops}", newline="\n")
    (tests / f"output{index:02d}.txt").write_text("".join(f"{a}\n" for a in solve(stock, operations)), newline="\n")


def query(n, wide=None):
    if wide:
        return (2, rng.randint(1, wide), rng.randint(n - wide + 1, n))
    l, r = sorted((rng.randint(1, n), rng.randint(1, n)))
    return (2, l, r)


def recount(n, top):
    return (1, rng.randint(1, n), rng.randint(0, top))


def mixed(n, q, query_share, top, wide=None):
    return [query(n, wide) if rng.random() < query_share else recount(n, top) for _ in range(q)]


rng = random.Random(2026)
write(0, [4, 0, 7, 2, 9], [(2, 1, 3), (1, 2, 5), (2, 1, 3), (1, 5, 0), (2, 3, 5)])
write(1, [10**9] * 3, [(2, 1, 3), (1, 2, 0), (2, 1, 3)])
write(2, [7], [(2, 1, 1), (1, 1, 0), (2, 1, 1), (1, 1, 10**9), (2, 1, 1)])
write(3, [0] * 1000, [query(1000) for _ in range(500)])
write(4, [10**9] * 1000, [query(1000) if rng.random() < 0.5 else (1, rng.randint(1, 1000), rng.choice([0, 10**9])) for _ in range(2000)])
# Recounts hammer a few shelves, sometimes with their current value.
write(5, [rng.randint(0, 50) for _ in range(200)],
      [query(200) if rng.random() < 0.5 else (1, rng.choice([1, 2, 100, 200]), rng.choice([0, 7, 10**9])) for _ in range(1000)])
write(6, [rng.randint(0, 10**9) for _ in range(500)],
      [(2, i, i) for i in (rng.randint(1, 500) for _ in range(1000))] + [recount(500, 10**9) for _ in range(500)] + [(2, i, i) for i in range(1, 501)])
write(7, [rng.randint(0, 20) for _ in range(50)], mixed(50, 200, 0.5, 20))
# Whole-aisle queries and recounts of the first and last shelves.
write(8, [rng.randint(0, 99) for _ in range(20000)],
      [rng.choice([(2, 1, 20000), (2, 1, 1), (2, 20000, 20000), (1, 1, rng.randint(0, 10**9)), (1, 20000, rng.randint(0, 10**9))]) for _ in range(5000)])
write(9, [rng.randint(0, 10**9) for _ in range(5000)], mixed(5000, 5000, 0.6, 10**9))
# Large: near-whole-aisle queries, so re-summing the range every time is too slow.
write(10, [rng.randint(0, 9) for _ in range(100000)], mixed(100000, 85000, 0.88, 9, wide=9))
write(11, [rng.randint(0, 99) for _ in range(100000)], mixed(100000, 50000, 0.7, 10**9, wide=2000))
print("wrote 12 tests")
