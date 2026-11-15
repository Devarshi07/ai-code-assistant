"""Deterministic pseudo-English dictionaries and queries for the scale tests.

The JavaScript edition has the same generator, so a seed produces the same
words in both languages.
"""

ONSETS = ["", "", "b", "b", "br", "c", "c", "ch", "cl", "d", "d", "dr", "f", "fl", "g", "gr", "h", "h",
          "j", "k", "l", "l", "m", "m", "n", "n", "p", "p", "pl", "r", "r", "s", "s", "sh", "sl", "sp",
          "st", "t", "t", "th", "tr", "v", "w", "w", "y", "z"]
VOWELS = ["a", "a", "e", "e", "i", "o", "u", "ai", "au", "ea", "ee", "ie", "oa", "oo", "ou", "y"]
CODAS = ["", "", "", "", "", "", "", "", "b", "ck", "d", "g", "l", "ll", "m", "n", "n", "nd", "ng",
         "nt", "p", "r", "r", "s", "st", "t", "t", "x"]
SUFFIXES = ["", "", "", "", "", "", "", "", "", "", "s", "s", "s", "ed", "er", "ing", "ly", "y"]


class Lcg:
    """32-bit linear congruential generator, identical in both editions."""

    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF

    def below(self, n):
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return (self.state >> 16) % n


def make_word(rng):
    parts = []
    for _ in range(1 + rng.below(2) + rng.below(2)):
        parts.append(ONSETS[rng.below(len(ONSETS))])
        parts.append(VOWELS[rng.below(len(VOWELS))])
        parts.append(CODAS[rng.below(len(CODAS))])
    parts.append(SUFFIXES[rng.below(len(SUFFIXES))])
    return "".join(parts)


def generate_words(seed, count):
    """count pseudo-words; expect some repeats."""
    rng = Lcg(seed)
    return [make_word(rng) for _ in range(count)]


def slot_patterns(words, seed, count, blank_percent=40):
    """Grid-fill queries: stored words with some squares still blank, e.g. "?ra??le"."""
    rng = Lcg(seed)
    patterns = []
    while len(patterns) < count:
        word = words[rng.below(len(words))]
        if len(word) < 4:
            continue
        squares = ["?" if rng.below(100) < blank_percent else ch for ch in word]
        if len(squares) - squares.count("?") >= 2:
            patterns.append("".join(squares))
    return patterns


def search_patterns(words, seed, count):
    """Solver-panel queries: the start of a word with a few blanks, then a star, e.g. "dr?n*"."""
    rng = Lcg(seed)
    patterns = []
    while len(patterns) < count:
        word = words[rng.below(len(words))]
        if len(word) < 6:
            continue
        start = ["?" if rng.below(100) < 35 else ch for ch in word[:3 + rng.below(len(word) - 4)]]
        if len(start) - start.count("?") >= 2:
            patterns.append("".join(start) + "*")
    return patterns
