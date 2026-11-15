"""Writes the test files for Anagram Groups. Run from this folder: python generator.py"""
import random
from collections import Counter
from pathlib import Path

ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def solve(words):
    groups = Counter("".join(sorted(word)) for word in words)
    return len(groups), max(groups.values())


def write(index, words):
    assert 1 <= len(words) <= 10**5 and sum(map(len, words)) <= 10**6
    assert all(1 <= len(word) <= 100 and set(word) <= set(ALPHABET) for word in words)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(words)}\n" + "".join(word + "\n" for word in words), newline="\n")
    groups, largest = solve(words)
    (tests / f"output{index:02d}.txt").write_text(f"{groups} {largest}\n", newline="\n")


rng = random.Random(4242)


def word(length, letters=ALPHABET):
    return "".join(rng.choice(letters) for _ in range(length))


def shuffled(text):
    letters = list(text)
    rng.shuffle(letters)
    return "".join(letters)


write(0, ["stone", "notes", "pots", "onset", "tops", "tones", "cat"])
write(1, ["ab", "ba", "ab", "aab", "b"])
write(2, ["z"])
write(3, ["level"] * 1000)
write(4, list(ALPHABET))
# Same letter set, same length or same letter-code sum, but different letter counts.
write(5, ["aab", "abb", "ab", "ba", "aabb", "abab", "bbaa", "baba", "a", "b", "ad", "bc", "ac", "bb", "abc", "aabc", "cab"])
lengths = list(range(1, 101))
rng.shuffle(lengths)
write(6, ["a" * k for k in lengths])
write(7, [word(4, "abcd") for _ in range(3000)])
# Maximum-length words. Each near miss trades one 'a' and one 'c' for two 'b's: same length and letter-code sum.
bases = [word(100) for _ in range(30)]
bases += [base.replace("a", "b", 1).replace("c", "b", 1) for base in bases[:10] if "a" in base and "c" in base]
write(8, [shuffled(rng.choice(bases)) for _ in range(3000)])
write(9, [word(rng.randint(2, 6), "abcde") for _ in range(100000)])
write(10, [word(rng.randint(1, 8)) for _ in range(100000)])
bases = [word(rng.randint(5, 10)) for _ in range(300)]
write(11, [shuffled(rng.choice(bases)) for _ in range(60000)])
print("wrote 12 tests")
