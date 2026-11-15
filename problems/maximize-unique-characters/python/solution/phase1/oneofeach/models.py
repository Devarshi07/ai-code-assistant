"""Data model: candidate words, solver selections and dated puzzles."""
from typing import List, NamedTuple

from .letters import FULL_MASK, letter_mask, mask_letters, normalize_word, popcount


class Word:
    """One candidate from the designers' word list.

    ``text`` is always normalized (lower-case a-z). ``mask`` holds the word's
    letters as a bitmask (see letters.py). ``difficulty`` runs from 1 (easy)
    to 3 (hard) and ``tags`` names the themes the word belongs to.
    """

    __slots__ = ("text", "difficulty", "tags", "mask")

    def __init__(self, text, difficulty=1, tags=()):
        self.text = normalize_word(text)
        self.difficulty = difficulty
        self.tags = frozenset(tags)
        self.mask = letter_mask(self.text)

    @property
    def letters(self):
        """The word's distinct letters in alphabetical order ('otter' -> 'eort')."""
        return mask_letters(self.mask)

    @property
    def length(self):
        """How many tiles the word puts on the board."""
        return len(self.text)

    @property
    def has_repeats(self):
        """True when some letter appears more than once in the word."""
        return popcount(self.mask) != self.length

    def __repr__(self):
        return f"Word({self.text!r})"


def as_words(items):
    """Accept Word objects or plain strings; return a list of Words."""
    return [item if isinstance(item, Word) else Word(item) for item in items]


class Selection(NamedTuple):
    """A solver answer: the chosen words in alphabetical order and the letters they cover."""
    words: List[str]
    total: int


class Puzzle:
    """A dated, themed board. Every letter may appear on it at most once."""

    def __init__(self, day, theme, words):
        self.day = day
        self.theme = theme
        self.words = as_words(words)

    @property
    def covered(self):
        """Mask of every letter that appears on the board."""
        mask = 0
        for word in self.words:
            mask |= word.mask
        return mask

    @property
    def tile_count(self):
        """Tiles shown on the board; the header and the score use this."""
        return sum(word.length for word in self.words)

    @property
    def unused_letters(self):
        """Letters of the alphabet that are not on the board."""
        return mask_letters(FULL_MASK & ~self.covered)

    def __repr__(self):
        return f"Puzzle({self.day!r}, {self.theme!r}, {[w.text for w in self.words]})"
