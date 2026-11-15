"""Writes the test files for Running Balance. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(b, transactions):
    balance = lowest = b
    first = -1
    for i, amount in enumerate(transactions, start=1):
        balance += amount
        if balance < 0 and first == -1:
            first = i
        lowest = min(lowest, balance)
    return first, lowest


def write(index, b, transactions):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(transactions)} {b}\n{' '.join(map(str, transactions))}\n")
    first, lowest = solve(b, transactions)
    (tests / f"output{index:02d}.txt").write_text(f"{first} {lowest}\n")


def touches_zero(rng, n, b, step):
    """A random walk that hits 0 several times without going below it, then dips to -1 on the last transaction."""
    balance, amounts = b, []
    for _ in range(n - 1):
        amount = max(rng.randint(-step, step), -balance)
        balance += amount
        amounts.append(amount)
    amounts.append(-balance - 1)
    return amounts


rng = random.Random(2026)
write(0, 50, [-20, 15, -60, 40, -30, -25])
write(1, 10, [-10, 5, -5, 8])
write(2, 0, [-1])
write(3, 7, [5])
write(4, 0, [0] * 8)
write(5, 1000, [5, -3, 7, -2, 10])
write(6, 0, [-5, 100, -200, 300])
write(7, 10**9, [10**9] * 5 + [-10**9] * 7)
write(8, 200, [rng.randint(-100, 100) for _ in range(50)])
write(9, 10**9, [rng.randint(-9 * 10**8, 10**9) for _ in range(1000)] + [rng.randint(-10**9, 5 * 10**8) for _ in range(1000)])
write(10, 10**5, [rng.randint(-1000, 1000) for _ in range(100000)])
write(11, 10**8, [rng.randint(-10**5, 3 * 10**5) for _ in range(100000)])
write(12, 10**9, [rng.randint(-10**6, 10**5) for _ in range(100000)])
write(13, 5000, touches_zero(rng, 100000, 5000, 1000))
print("wrote 14 tests")
