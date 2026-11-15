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


def deletes(word, depth=MAX_DISTANCE):
    """word plus every string made by deleting up to `depth` of its letters."""
    variants = {word}
    frontier = {word}
    for _ in range(depth):
        frontier = {w[:i] + w[i + 1:] for w in frontier for i in range(len(w))}
        variants |= frontier
    return variants


class Suggester:
    """Ranks dictionary words as replacements for a misspelled word.

    Symmetric-delete index: if two words are within MAX_DISTANCE edits, then
    deleting at most MAX_DISTANCE letters from each yields a common string
    (a substitution is one deletion on each side, an insertion is a deletion
    on the other side). The index maps every such deletion variant of every
    dictionary word to the words that produce it, so a lookup only verifies
    the handful of words that share a variant with the misspelling.

    The index is built once, from the dictionary as it is when the
    suggester is created.
    """

    def __init__(self, dictionary):
        self.dictionary = dictionary
        self._index = {}
        for entry in dictionary.words():
            for variant in deletes(entry):
                bucket = self._index.get(variant)
                if bucket is None:
                    self._index[variant] = [entry]
                else:
                    bucket.append(entry)

    def suggest(self, word, limit=DEFAULT_LIMIT):
        """Up to `limit` dictionary words within MAX_DISTANCE edits of word.

        The word is compared in its normalized (lower-case) form and the
        results are dictionary keys. Closest words come first; ties go to
        the more frequent word, then to the alphabetically smaller one.
        """
        key = normalize(word)
        candidates = set()
        for variant in deletes(key):
            candidates.update(self._index.get(variant, ()))
        ranked = []
        for candidate in candidates:
            distance = edit_distance(key, candidate)
            if distance <= MAX_DISTANCE:
                ranked.append((distance, -self.dictionary.frequency(candidate), candidate))
        ranked.sort()
        return [candidate for _, _, candidate in ranked[:max(limit, 0)]]
