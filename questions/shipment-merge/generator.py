"""Writes the test files for Shipment Merge. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(windows):
    merged = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def write(index, windows):
    assert 1 <= len(windows) <= 10**5 and all(0 <= s <= e <= 10**9 for s, e in windows)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    merged = solve(windows)
    lines = [str(len(windows))] + [f"{s} {e}" for s, e in windows]
    (tests / f"input{index:02d}.txt").write_text('\n'.join(lines) + '\n', newline="\n")
    lines = [str(len(merged))] + [f"{s} {e}" for s, e in merged]
    (tests / f"output{index:02d}.txt").write_text('\n'.join(lines) + '\n', newline="\n")


def window(high, longest):
    start = rng.randint(0, high)
    return start, min(10**9, start + rng.randint(0, longest))


rng = random.Random(2026)
write(0, [(14, 20), (3, 5), (9, 11), (1, 4), (20, 22), (7, 8)])
write(1, [(6, 6), (2, 10), (4, 5), (11, 11)])
write(2, [(0, 10**9)])
write(3, [(5, 9)] * 1000)
chain = [(i, i + 1) for i in range(1000)]
rng.shuffle(chain)
write(4, chain)
gaps = [(2 * i, 2 * i + 1) for i in range(1000)]
rng.shuffle(gaps)
write(5, gaps)
write(6, [(x, x) for x in (rng.choice([0, 1, 2, 3, 7, 10**9 - 1, 10**9]) for _ in range(300))])
write(7, [window(100, 10) for _ in range(50)])
write(8, [window(10**6, 300) for _ in range(5000)])
write(9, [window(4 * 10**5, 6) for _ in range(80000)])
write(10, [window(10**9, 2 * 10**5) for _ in range(30000)])
# Clusters of windows that only touch end to start, separated by gaps of at least 1.
clusters, t = [], 0
while len(clusters) < 30000:
    t += rng.choice([1, 1, 2, 1000])
    for _ in range(rng.randint(1, 20)):
        length = rng.randint(0, 50)
        clusters.append((t, t + length))
        t += length
rng.shuffle(clusters)
write(11, clusters)
middle = 5 * 10**8
nested = [(middle - w, middle + w) for w in (rng.randint(0, 4 * 10**8) for _ in range(24000))]
nested += [(x, x) for x in (rng.randint(0, 10**8 - 1) for _ in range(500))]
nested += [(x, x) for x in (rng.randint(9 * 10**8 + 1, 10**9) for _ in range(500))]
rng.shuffle(nested)
write(12, nested)
print("wrote 13 tests")
