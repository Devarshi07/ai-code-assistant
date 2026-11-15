"""Writes the test files for Word Leaderboard. Run from this folder: python generator.py"""
import random
import string
from collections import Counter
from pathlib import Path


def solve(lines, k):
    counts = Counter(word for line in lines for word in line.split(" "))
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [f"{word} {count}" for word, count in ranked[:k]]


def write(index, lines, k):
    words = [w for line in lines for w in line.split(" ")]
    assert 1 <= len(lines) <= 10**4 and 1 <= k <= 10**5 and len(words) <= 10**5
    assert all(1 <= len(w) <= 12 and set(w) <= set(string.ascii_lowercase) for w in words)
    tests = Path(__file__).with_name("tests")
    tests.mkdir(exist_ok=True)
    (tests / f"input{index:02d}.txt").write_text(f"{len(lines)} {k}\n" + "".join(line + "\n" for line in lines))
    (tests / f"output{index:02d}.txt").write_text("".join(entry + "\n" for entry in solve(lines, k)))


def word(rng, lo=1, hi=12):
    return "".join(rng.choice(string.ascii_lowercase) for _ in range(rng.randint(lo, hi)))


def vocabulary(rng, size, lo=1, hi=12):
    words = set()
    while len(words) < size:
        words.add(word(rng, lo, hi))
    return sorted(words)


def to_lines(rng, words, most):
    lines, i = [], 0
    while i < len(words):
        take = rng.randint(1, most)
        lines.append(" ".join(words[i:i + take]))
        i += take
    return lines


def zipf(rng, vocab, total, s=1.0):
    vocab = vocab[:]
    rng.shuffle(vocab)
    return rng.choices(vocab, weights=[1 / (r + 1) ** s for r in range(len(vocab))], k=total)


def with_counts(rng, counts):
    bag = [w for w, c in counts.items() for _ in range(c)]
    rng.shuffle(bag)
    return bag


rng = random.Random(2026)
write(0, ["the cat sat on the mat", "the dog sat", "a cat and a dog"], 3)
write(1, ["note notes no", "notebook no note"], 6)
write(2, ["a"], 1)
write(3, ["echo echo echo", "echo", "echo echo"], 3)
write(4, ["zebra yak xylophone", "walrus vulture urchin", "toucan swan raven quail", "penguin owl newt"], 5)
write(5, to_lines(rng, with_counts(rng, {w: 3 for w in ["bab", "abcd", "a", "ba", "abd", "aa", "abc", "b", "ab"]}), 5), 9)
tied = vocabulary(rng, 30, 3, 8)
write(6, to_lines(rng, with_counts(rng, {w: 9 if i < 3 else 6 if i < 13 else 2 for i, w in enumerate(rng.sample(tied, 30))}), 8), 8)
few = vocabulary(rng, 12, 2, 6)
write(7, to_lines(rng, [rng.choice(few) for _ in range(200)], 10), 100000)
write(8, to_lines(rng, zipf(rng, vocabulary(rng, 400), 3000), 25), 25)
write(9, zipf(rng, vocabulary(rng, 2000), 10000), 10)
write(10, to_lines(rng, zipf(rng, vocabulary(rng, 5000), 100000), 30), 100)
write(11, [" ".join(word(rng, 3, 3) for _ in range(100000))], 1000)
roots = vocabulary(rng, 2000, 12, 12)
prefixes = sorted({r[:j] for r in roots for j in range(1, 13)})
bag = [rng.choice(prefixes) for _ in range(100000)]
write(12, [" ".join(bag[i:i + 10]) for i in range(0, 100000, 10)], 100000)
print("wrote 13 tests")
