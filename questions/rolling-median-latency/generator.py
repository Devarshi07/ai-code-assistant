"""Writes the test files for Rolling Median Latency. Run from this folder: python generator.py"""
import random
from bisect import bisect_left, insort
from pathlib import Path


def solve(latency, k):
    window = sorted(latency[:k])
    medians = [window[(k - 1) // 2]]
    for i in range(k, len(latency)):
        del window[bisect_left(window, latency[i - k])]
        insort(window, latency[i])
        medians.append(window[(k - 1) // 2])
    return medians


def write(index, latency, k):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(latency)} {k}\n{' '.join(map(str, latency))}\n", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(" ".join(map(str, solve(latency, k))) + "\n", newline="\n")


rng = random.Random(2026)
write(0, [12, 40, 7, 33, 25, 18, 90, 61], 3)
write(1, [5, 9, 2, 9, 6, 1], 4)
write(2, [10**9], 1)
write(3, [rng.randint(1, 100) for _ in range(10)], 10)
write(4, [rng.randint(1, 10**9) for _ in range(50)], 1)
write(5, [500] * 1000, 100)
write(6, list(range(1, 2001)), 500)
write(7, list(range(3000, 0, -1)), 777)
write(8, [rng.randint(1, 5) for _ in range(300)], 12)
write(9, [rng.choice([1, 10**9, rng.randint(1, 10**9)]) for _ in range(2000)], 2)
write(10, [rng.randint(1, 99999) for _ in range(100000)], 50000)
# Fast traffic, then a slow regime, with occasional spikes.
write(11, [rng.randint(10**4, 10**6) if rng.random() < 0.03 else rng.randint(20, 120) if i < 50000 else rng.randint(200, 900)
           for i in range(100000)], 30001)
# A slow triangle wave with many repeated values.
write(12, [1 + abs(i % 50000 - 25000) // 25 + rng.randint(0, 20) for i in range(100000)], 20000)
print("wrote 13 tests")
