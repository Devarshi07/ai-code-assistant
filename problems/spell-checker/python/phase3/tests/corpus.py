"""Deterministic large dictionaries and typo batches for the scale tests.

The JavaScript tests use the same generator, so both languages see exactly
the same words, frequencies and queries.
"""
from spellcheck import Dictionary

ONSETS = ("", "", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s",
          "t", "v", "w", "z", "br", "ch", "cl", "dr", "fl", "gr", "pl", "sh", "st", "th", "tr")
VOWELS = ("a", "e", "i", "o", "u", "a", "e", "i", "o", "y", "ai", "ea", "ee", "oo", "ou")
CODAS = ("", "", "", "", "", "n", "r", "s", "t", "l", "m", "d", "ck", "nd", "st", "ng")
SUFFIXES = ("", "", "", "", "", "", "s", "s", "ed", "er", "ing", "ly")
SYLLABLES = (1, 1, 2, 2, 2, 3)
LETTERS = "abcdefghijklmnopqrstuvwxyz"


class Lcg:
    """Small 32-bit linear congruential generator."""

    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF

    def below(self, n):
        """A pseudo-random integer in range(n)."""
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return (self.state * n) >> 32

    def pick(self, items):
        return items[self.below(len(items))]


def pseudo_word(rng):
    syllables = rng.pick(SYLLABLES)
    word = "".join(rng.pick(ONSETS) + rng.pick(VOWELS) + rng.pick(CODAS) for _ in range(syllables))
    return word + rng.pick(SUFFIXES)


def large_dictionary(size, seed=1):
    """The base word list plus generated words: `size` entries in total."""
    dictionary = Dictionary.load()
    rng = Lcg(seed)
    while len(dictionary) < size:
        word = pseudo_word(rng)
        count = 1 + rng.below(400)
        if word not in dictionary:
            dictionary.add(word, count)
    return dictionary


def typo(rng, word):
    """word with one random insertion, deletion, substitution or swap."""
    kind = rng.below(4)
    if kind == 0 or len(word) < 2:
        i = rng.below(len(word) + 1)
        return word[:i] + rng.pick(LETTERS) + word[i:]
    if kind == 1:
        i = rng.below(len(word))
        return word[:i] + word[i + 1:]
    if kind == 2:
        i = rng.below(len(word))
        return word[:i] + rng.pick(LETTERS) + word[i + 1:]
    i = rng.below(len(word) - 1)
    return word[:i] + word[i + 1] + word[i] + word[i + 2:]


def typo_batch(dictionary, count, seed=7):
    """`count` misspellings, each a dictionary word with one or two typos."""
    rng = Lcg(seed)
    words = dictionary.words()
    batch = []
    for _ in range(count):
        word = words[rng.below(len(words))]
        for _ in range(1 + rng.below(2)):
            word = typo(rng, word)
        batch.append(word)
    return batch
