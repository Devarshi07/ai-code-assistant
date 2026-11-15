"""Spelling suggestions: the dictionary words closest to a misspelling.

Closeness is Levenshtein edit distance, the fewest single-character
insertions, deletions and substitutions that turn one word into the other.
Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").
"""
from .dictionary import normalize

MAX_DISTANCE = 2    # anything further away is not a useful suggestion
DEFAULT_LIMIT = 5   # entries shown in the editor's right-click menu


def edit_distance(a, b):
    """Levenshtein distance between strings a and b."""
    raise NotImplementedError("Phase 2: edit_distance is not implemented yet")


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
        raise NotImplementedError("Phase 2: Suggester.suggest is not implemented yet")
