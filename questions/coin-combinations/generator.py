"""Writes the test files for Coin Combinations. Run from this folder: python generator.py"""
import random
from pathlib import Path

MOD = 10**9 + 7


def solve(amount, coins):
    ways = [1] + [0] * amount
    for c in coins:
        for a in range(c, amount + 1):
            ways[a] = (ways[a] + ways[a - c]) % MOD
    return ways[amount]


def write(index, amount, coins):
    assert 1 <= len(coins) <= 100 and len(set(coins)) == len(coins) and 0 <= amount <= 10**5
    assert all(1 <= c <= 10**5 for c in coins)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(coins)} {amount}\n{' '.join(map(str, coins))}\n", newline="\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(amount, coins)}\n", newline="\n")


rng = random.Random(2026)
write(0, 6, [4, 1, 3])
write(1, 7, [4, 6])
write(2, 0, [5, 2, 9])
write(3, 49, [50, 60, 70])
write(4, 100000, [1])
write(5, 100000, [2, 1])
write(6, 100000, [100000, 99999, 1])
write(7, 60, rng.sample(range(1, 21), 5))
write(8, 300, list(range(12, 1, -1)))
write(9, 5000, rng.sample(range(1, 201), 30))
write(10, 100000, rng.sample(range(1, 101), 100))
write(11, 100000, rng.sample(range(1, 1001), 100))
write(12, 100000, rng.sample(range(1, 100001), 100))
write(13, 99991, rng.sample(range(2, 5001), 100))
print("wrote 14 tests")
