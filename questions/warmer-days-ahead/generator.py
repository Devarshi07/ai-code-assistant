"""Writes the test files for Warmer Days Ahead. Run from this folder: python generator.py"""
import random
from pathlib import Path


def solve(temps):
    answer = [0] * len(temps)
    waiting = []
    for i, t in enumerate(temps):
        while waiting and temps[waiting[-1]] < t:
            j = waiting.pop()
            answer[j] = i - j
        waiting.append(i)
    return answer


def write(index, temps):
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(temps)}\n{' '.join(map(str, temps))}\n")
    (tests / f"output{index:02d}.txt").write_text(f"{' '.join(map(str, solve(temps)))}\n")


def falling(count, low, high):
    """A cold spell: readings that never rise, with random runs of equal values."""
    return sorted((rng.randint(low, high) for _ in range(count)), reverse=True)


def sawtooth(blocks, length):
    """Falling runs; each run starts warmer than everything before it."""
    temps = []
    for k in range(blocks):
        top = -900 + 7 * k
        temps += [top] + falling(length - 1, -900, top)
    return temps


rng = random.Random(7310)
write(0, [152, 148, 160, 171, 165, 158, 175, 170])
write(1, [-15, -15, -20, -15, -10])
write(2, [215])
write(3, [-5, 0, 12, 37, 80, 81, 150, 222, 300, 600])
write(4, [-37] * 1000)
write(5, [rng.choice([-900, 0, 600]) for _ in range(50)])
write(6, [rng.randint(-50, 50) for _ in range(200)])
write(7, [rng.randint(-900, 600) for _ in range(5000)])
write(8, falling(300000, 0, 99))
write(9, falling(200000, 10, 99) + [rng.randint(-9, 9) for _ in range(100000)])
write(10, [rng.randint(-900, 600) for _ in range(50000)])
write(11, falling(10000, -900, 600) + sorted(rng.randint(-900, 600) for _ in range(10000)))
write(12, sawtooth(150, 200))
print("wrote 13 tests")
