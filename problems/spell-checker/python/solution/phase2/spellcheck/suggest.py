"""Spelling suggestions: the dictionary words closest to a misspelling.

Closeness is Levenshtein edit distance, the fewest single-character
insertions, deletions and substitutions that turn one word into the other.
Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").
"""
from .dictionary import normalize

MAX_DISTANCE = 2    # anything further away is not a useful suggestion
DEFAULT_LIMIT = 5   # entries shown in the editor's right-click menu


def edit_distance(a, b):
    """Levenshtein distance between strings a and b.

    Classic dynamic program, keeping one row of the table at a time:
    row[j] is the distance between the current prefix of a and b[:j].
    """
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        previous, row[0] = row[0], i
        for j, cb in enumerate(b, 1):
            current = min(row[j] + 1,                    # delete ca
                          row[j - 1] + 1,                # insert cb
                          previous + (ca != cb))         # substitute
            previous, row[j] = row[j], current
    return row[-1]


class Suggester:
    """Ranks dictionary words as replacements for a misspelled word."""

    def __init__(self, dictionary):
        self.dictionary = dictionary

    def suggest(self, word, limit=DEFAULT_LIMIT):
        """Up to `limit` dictionary words within MAX_DISTANCE edits of word.

        The word is compared in its normalized (lower-case) form and the
        results are dictionary keys. Closest words come first; ties go to
        the more frequent word, then to the alphabetically smaller one.
        """
        key = normalize(word)
        ranked = []
        for candidate in self.dictionary.words():
            distance = edit_distance(key, candidate)
            if distance <= MAX_DISTANCE:
                ranked.append((distance, -self.dictionary.frequency(candidate), candidate))
        ranked.sort()
        return [candidate for _, _, candidate in ranked[:max(limit, 0)]]
