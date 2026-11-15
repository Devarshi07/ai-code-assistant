"""Writes the test files for Longest Unique Stretch. Run from this folder: python generator.py"""
import random
from pathlib import Path

PRINTABLE = "".join(chr(code) for code in range(33, 127))  # the 94 printable characters other than space


def solve(s):
    last = {}
    left = best_len = best_start = 0
    for i, ch in enumerate(s):
        if last.get(ch, -1) >= left:
            left = last[ch] + 1
        last[ch] = i
        if i - left + 1 > best_len:
            best_len, best_start = i - left + 1, left
    return best_len, best_start


def write(index, s):
    assert 1 <= len(s) <= 10**5 and set(s) <= set(PRINTABLE)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(s + "\n", newline="\n")
    length, start = solve(s)
    (tests / f"output{index:02d}.txt").write_text(f"{length} {start}\n", newline="\n")


rng = random.Random(5521)


def random_string(n, alphabet):
    return "".join(rng.choice(alphabet) for _ in range(n))


write(0, "ab#ca#b!")
write(1, "1213121")
write(2, "~")
write(3, "q" * 1000)
write(4, "abbacd")  # the window's left edge must never move backwards
write(5, PRINTABLE)
write(6, PRINTABLE * 2)  # ties: the earliest start wins
write(7, random_string(5000, "\\\"'`$%^&*"))
write(8, "x" * 1000 + "".join(rng.sample(PRINTABLE, len(PRINTABLE))))
write(9, random_string(100000, PRINTABLE))
# Every 93-character window of the cycle is unique; a single '~' late in the string allows one 94-character stretch.
cycle = PRINTABLE[:-1]
base = (cycle * (100000 // len(cycle) + 1))[:99999]
write(10, base[:87654] + "~" + base[87654:])
write(11, random_string(100000, "abcdefghij"))
pool = PRINTABLE[:20]
write(12, random_string(50000, pool) + "".join(rng.sample(PRINTABLE[20:], 60)) + random_string(49940, pool))
print("wrote 13 tests")
