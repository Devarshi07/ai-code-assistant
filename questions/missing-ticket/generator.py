"""Writes the test files for Missing Ticket. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(scans):
    n = len(scans)
    diff = sum(scans) - n * (n + 1) // 2  # duplicate - missing
    squares = sum(v * v for v in scans) - n * (n + 1) * (2 * n + 1) // 6  # duplicate^2 - missing^2
    total = squares // diff  # duplicate + missing
    duplicate = (total + diff) // 2
    return duplicate, duplicate - diff


def write(index, scans):
    n = len(scans)
    assert 2 <= n <= 2 * 10**5 and all(1 <= v <= n for v in scans) and len(set(scans)) == n - 1
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{n}\n{' '.join(map(str, scans))}\n", newline="\n")
    duplicate, missing = solve(scans)
    (tests / f"output{index:02d}.txt").write_text(f"{duplicate} {missing}\n", newline="\n")


rng = random.Random(7310)


def ticket_log(n, duplicate, missing, order="shuffle"):
    scans = [v for v in range(1, n + 1) if v != missing] + [duplicate]
    if order == "shuffle":
        rng.shuffle(scans)
    else:
        scans.sort(reverse=order == "reversed")
    return scans


write(0, [3, 1, 4, 4, 6, 2])
write(1, [2, 5, 1, 5, 3])
write(2, [1, 1])
write(3, [2, 2])
write(4, ticket_log(10, 5, 4, "sorted"))
write(5, ticket_log(1000, 1, 1000))
write(6, ticket_log(1000, 1000, 1))
write(7, ticket_log(5000, *rng.sample(range(1, 5001), 2), "reversed"))
write(8, [6, 2, 7, 1, 4, 3, 6])
write(9, ticket_log(150000, *rng.sample(range(1, 150001), 2)))
write(10, ticket_log(120000, 119998, 3, "sorted"))
write(11, ticket_log(100000, 50001, 50000))
print("wrote 12 tests")
