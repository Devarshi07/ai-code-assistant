"""Writes the test files for Playlist Rotation. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(tracks, d, positions):
    shift = d % len(tracks)
    return [tracks[(p + shift) % len(tracks)] for p in positions]


def write(index, tracks, d, positions):
    n = len(tracks)
    assert 1 <= n <= 10**5 and 0 <= d <= 10**9 and 1 <= len(positions) <= 10**5
    assert all(1 <= x <= 10**6 for x in tracks) and all(0 <= p < n for p in positions)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(
        f"{n} {d} {len(positions)}\n{' '.join(map(str, tracks))}\n{' '.join(map(str, positions))}\n")
    (tests / f"output{index:02d}.txt").write_text("".join(f"{x}\n" for x in solve(tracks, d, positions)))


rng = random.Random(2026)
write(0, [4, 8, 15, 16, 23], 2, [0, 3, 4])
write(1, [10, 20, 30], 7, [0, 1, 2])
write(2, [42], 10**9, [0, 0, 0])
write(3, [5, 1, 4, 2, 3], 0, [4, 3, 2, 1, 0])
write(4, [11, 12, 13, 14, 15, 16], 18, [0, 1, 2, 3, 4, 5])
write(5, [rng.randint(1, 10**6) for _ in range(8)], 7, list(range(8)))
write(6, [rng.choice([7, 7, 7, 9]) for _ in range(9)], 10**9, [rng.randrange(9) for _ in range(20)])
write(7, [rng.randint(1, 10**6) for _ in range(1000)], rng.randint(0, 10**9), [rng.randrange(1000) for _ in range(1000)])
write(8, rng.sample(range(1, 10**6 + 1), 5000), 10**9 - 1, rng.sample(range(5000), 5000))
write(9, [rng.randint(1, 9999) for _ in range(100000)], 999999937, [rng.randrange(100000) for _ in range(30000)])
write(10, rng.sample(range(1, 100001), 100000), 900049999, [rng.randrange(100000) for _ in range(20000)])
write(11, [rng.randint(1, 9) for _ in range(99991)], 10**9, [rng.randrange(99991) for _ in range(50000)])
write(12, [rng.randint(1, 99) for _ in range(100000)], rng.randint(10**8, 10**9), [99999, 0] + [rng.randrange(100000) for _ in range(9998)])
print("wrote 13 tests")
