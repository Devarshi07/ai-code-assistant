"""Writes the test files for Minimum Shipping Capacity. Run from this folder: python generator.py"""
import random
from pathlib import Path


def days_needed(weights, capacity):
    days, load = 1, 0
    for w in weights:
        if load + w > capacity:
            days += 1
            load = 0
        load += w
    return days


def solve(weights, d):
    lo, hi = max(weights), sum(weights)
    while lo < hi:
        mid = (lo + hi) // 2
        if days_needed(weights, mid) <= d:
            hi = mid
        else:
            lo = mid + 1
    return lo


def write(index, weights, d):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(weights)} {d}\n{' '.join(map(str, weights))}\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(weights, d)}\n")


rng = random.Random(4417)
write(0, [4, 8, 3, 6, 2, 5, 7, 1], 3)
write(1, [1, 2, 10, 3, 4], 4)
write(2, [7], 1)
write(3, [rng.randint(1, 10**4) for _ in range(1000)], 1)
write(4, [rng.randint(1, 10**4) for _ in range(1000)], 1000)
write(5, [6] * 12, 5)
write(6, [rng.randint(1, 20) for _ in range(40)], 7)
write(7, [rng.randint(1, 10**4) for _ in range(2000)], 37)
write(8, [rng.randint(1, 10**4) for _ in range(100000)], 3)
write(9, [rng.randint(9990, 10**4) for _ in range(100000)], 49999)
write(10, [rng.randint(1, 10**4) for _ in range(100000)], 1000)
write(11, [rng.randint(1, 10) for _ in range(50000)] + [rng.randint(9000, 10**4) for _ in range(50000)], 2)
write(12, [10**4] * 100000, 1)
print("wrote 13 tests")
