"""Writes the test files for Longest Climb Count. Run from this folder: python generator.py"""
import random
from bisect import bisect_left
from pathlib import Path

MOD = 10**9 + 7


def solve(alt):
    # Patience piles: an element on pile i ends a longest climb of length i + 1. Each pile keeps
    # its values in placement order (non-increasing) with prefix sums of their climb counts.
    tops, values, sums = [], [], []
    for x in alt:
        i = bisect_left(tops, x)
        ways = 1
        if i > 0:
            prev = values[i - 1]
            lo, hi = 0, len(prev)
            while lo < hi:
                mid = (lo + hi) // 2
                if prev[mid] < x:
                    hi = mid
                else:
                    lo = mid + 1
            ways = (sums[i - 1][-1] - sums[i - 1][lo]) % MOD
        if i == len(tops):
            tops.append(x)
            values.append([x])
            sums.append([0, ways])
        else:
            tops[i] = x
            values[i].append(x)
            sums[i].append((sums[i][-1] + ways) % MOD)
    return len(tops), sums[-1][-1]


def write(index, alt):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    length, ways = solve(alt)
    (tests / f"input{index:02d}.txt").write_text(f"{len(alt)}\n{' '.join(map(str, alt))}\n", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(f"{length} {ways}\n", newline="\n")


rng = random.Random(2026)
write(0, [3, 1, 4, 1, 5, 9, 2])
write(1, [5, 5, 5, 5])
write(2, [-10**9])
write(3, [7, 3])
write(4, list(range(-500, 500)))
write(5, list(range(1000, 0, -1)))
# Swapped pairs 2 1 4 3 ...: 2^1000 longest climbs.
write(6, [v for i in range(1000) for v in (2 * i + 2, 2 * i + 1)])
write(7, [rng.randint(1, 6) for _ in range(60)])
write(8, [rng.choice([-10**9, 0, 10**9]) for _ in range(500)])
write(9, [rng.randint(-10**9, 10**9) for _ in range(3000)])
write(10, [rng.randint(1, 10**6) for _ in range(100000)])
# 1000 descending blocks of 100 values, each block above the last: 100^1000 longest climbs.
write(11, [b * 100 + (99 - j) for b in range(1000) for j in range(100)])
# A noisy steady climb.
write(12, [i * 10 + rng.randint(-5000, 5000) for i in range(100000)])
write(13, [rng.randint(1, 500) for _ in range(100000)])
print("wrote 14 tests")
