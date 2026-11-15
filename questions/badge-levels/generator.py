"""Writes the test files for Badge Levels. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(scores, m, g, t):
    result = []
    for s in scores:
        c = (s + m - 1) // m * m
        result.append(c if s >= t and c - s < g else s)
    return result


def write(index, scores, m, g, t):
    assert 1 <= len(scores) <= 10**5 and 1 <= m <= 10**9 and 0 <= g <= 10**9 and 0 <= t <= 10**9
    assert all(0 <= s <= 10**9 for s in scores)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(scores)} {m} {g} {t}\n{' '.join(map(str, scores))}\n")
    (tests / f"output{index:02d}.txt").write_text("".join(f"{x}\n" for x in solve(scores, m, g, t)))


rng = random.Random(2026)
write(0, [39, 42, 43, 59, 60], 5, 3, 40)
write(1, [0, 180, 275, 10**9], 100, 25, 0)
write(2, [0], 1, 0, 0)
write(3, [rng.randint(0, 1000) for _ in range(10)], 7, 0, 0)
write(4, [rng.randint(0, 10**9) for _ in range(10)] + [10**9], 1, 10**9, 0)
write(5, [rng.randint(0, 999) for _ in range(12)], 10, 9, 1000)
write(6, list(range(30)), 7, 10, 0)
write(7, list(range(101)), 5, 3, 38)
write(8, [10**9, 999999999, 999999998, 1, 0, 600000000, 599999999, 10**9], 999999999, 999999999, 600000000)
write(9, [rng.randint(0, 1000) for _ in range(1000)], rng.randint(1, 50), rng.randint(0, 60), rng.randint(0, 500))
write(10, [rng.randint(0, 100) for _ in range(100000)], 5, 3, 38)
write(11, [rng.randint(0, 9999) for _ in range(100000)], 1000, 200, 5000)
write(12, [rng.randint(0, 10**9) for _ in range(30000)], 123456789, 10**8, 2 * 10**8)
print("wrote 13 tests")
