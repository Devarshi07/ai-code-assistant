"""Writes the test files for Subarray Target Sums. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(arr, k):
    seen = {0: 1}
    prefix = total = 0
    for value in arr:
        prefix += value
        total += seen.get(prefix - k, 0)
        seen[prefix] = seen.get(prefix, 0) + 1
    return total


def write(index, arr, k):
    assert 1 <= len(arr) <= 10**5 and all(-10**9 <= v <= 10**9 for v in arr) and -10**14 <= k <= 10**14
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(arr)} {k}\n{' '.join(map(str, arr))}\n", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(arr, k)}\n", newline="\n")


def planted(arr):
    """The sum of a random stretch, so at least one stretch matches."""
    i = rng.randrange(len(arr))
    j = rng.randrange(i, len(arr))
    return sum(arr[i:j + 1])


rng = random.Random(2026)
write(0, [1, 2, -1, 1, 3, -3], 3)
write(1, [2, -2, 2, -2], 0)
write(2, [7], 7)
write(3, [-7], 7)
write(4, [-3] * 5, -6)
write(5, [rng.randint(-5, 5) for _ in range(40)], -4)
write(6, [rng.randint(-50, 50) for _ in range(2000)], 25)
write(7, [0] * 100000, 0)
write(8, [1, -1] * 50000, 0)
big = [rng.randint(-10**9, 10**9) for _ in range(100000)]
write(9, big, planted(big))
write(10, [rng.randint(-20, 20) for _ in range(100000)], 10)
write(11, [10**9] * 50000, 25 * 10**12)
write(12, [rng.randint(-1000, 1000) for _ in range(100000)], -12345)
print("wrote 13 tests")
