"""Writes the test files for Pairs With Difference. Run from this folder: python generator.py"""
import random
from collections import Counter
from pathlib import Path


def solve(arr, k):
    counts = Counter(arr)
    if k == 0:
        return sum(c * (c - 1) // 2 for c in counts.values())
    return sum(c * counts.get(v + k, 0) for v, c in counts.items())


def write(index, arr, k):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(arr)} {k}\n{' '.join(map(str, arr))}\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(arr, k)}\n")


rng = random.Random(2026)
write(0, [1, 5, 3, 4, 2], 2)
write(1, [7, 7, 7, 2], 0)
write(2, [42], 0)
write(3, [5] * 1000, 0)
write(4, [5] * 1000, 5)
write(5, [-3, -1, 1, 3, -3, 5, -5, 0], 2)
write(6, [rng.randint(-20, 20) for _ in range(60)], 4)
write(7, [rng.randint(-10**9, 10**9) for _ in range(5000)], 1)
write(8, [rng.randint(0, 50) for _ in range(100000)], 3)
write(9, rng.sample(range(-10**6, 10**6), 100000), 1)
write(10, [rng.randint(1, 300) for _ in range(100000)], 0)
write(11, [rng.randint(-10**6, 10**6) for _ in range(100000)], 1000)
write(12, [rng.choice([-10**9, 10**9, 0]) for _ in range(100000)], 10**9)
print("wrote 13 tests")
