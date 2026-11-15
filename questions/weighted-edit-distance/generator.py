"""Writes the test files for Weighted Edit Distance. Run from this folder: python generator.py"""
import random
import string
from pathlib import Path


def solve(a, b, ins, dele, rep):
    prev = [j * ins for j in range(len(b) + 1)]
    for i, ca in enumerate(a, 1):
        cur = [i * dele]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j - 1] + (0 if ca == cb else rep), prev[j] + dele, cur[j - 1] + ins))
        prev = cur
    return prev[-1]


def write(index, a, b, ins, dele, rep):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{a}\n{b}\n{ins} {dele} {rep}\n")
    (tests / f"output{index:02d}.txt").write_text(f"{solve(a, b, ins, dele, rep)}\n")


def text(length, letters=string.ascii_lowercase):
    return ''.join(rng.choice(letters) for _ in range(length))


def mutate(s):
    """A later version of s: a few characters deleted, replaced or inserted."""
    out = []
    for ch in s:
        roll = rng.random()
        if roll < 0.04:
            continue
        out.append(rng.choice(string.ascii_lowercase) if roll < 0.08 else ch)
        if rng.random() < 0.03:
            out.append(rng.choice(string.ascii_lowercase))
    return ''.join(out[:3000])


rng = random.Random(9137)
write(0, "monday", "money", 2, 3, 4)
write(1, "abc", "adc", 1, 1, 5)
write(2, "q", "q", 5, 5, 5)
write(3, "x", text(3000), 5, 7, 3)
write(4, text(3000), "m", 4, 1, 9)
write(5, "a" * 2500, "a" * 1200, 9, 4, 6)
write(6, text(7, "ab"), text(8, "ab"), 3, 2, 4)
write(7, text(400), text(350), rng.randint(1, 100), rng.randint(1, 100), rng.randint(1, 100))
write(8, text(3000, "acgt"), text(3000, "acgt"), 3, 2, 4)
base = text(3000)
write(9, base, mutate(base), 7, 5, 9)
write(10, text(3000, "abcdefghijklm"), text(3000, "nopqrstuvwxyz"), 10**6, 10**6, 10**6)
write(11, text(2999), text(3000), 1, 1, 10**6)
write(12, text(3000), text(1500), 10**6, 1, 500000)
print("wrote 13 tests")
