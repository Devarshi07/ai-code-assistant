"""Crossword patterns: the syntax used by the solver panel and the grid filler.

A pattern describes a whole entry, one symbol per square:

    letter   that exact letter                    c?t   -> cat, cot, cut
    ?        exactly one letter, any letter       ???   -> every 3-letter word
    *        any run of letters, including none   c*t   -> cat, chart, cut, ...
                                                  cat*  -> cat, cats, catalog, ...

A pattern must match the *whole* word: "c?t" matches neither "scat" nor "cats".

Setters often type blanks as "." or "_", so both are read as "?". Letters get
the same clean-up as stored words (case, accents, spaces, hyphens and
apostrophes are ignored), so "C.T", "ç?t" and "c-?-t" all mean "c?t".
Runs of stars collapse: "c**t" is the same pattern as "c*t".
"""
from .normalize import IGNORED, LETTERS, strip_accents

ANY_LETTER = "?"
ANY_RUN = "*"
BLANK_ALIASES = frozenset("?._")
# Our largest grid is 25x25, so anything longer is almost certainly a paste mistake.
MAX_SYMBOLS = 25


class PatternError(ValueError):
    """Raised for text that is not a valid crossword pattern."""


class Pattern:
    """A parsed crossword pattern. Create one with parse_pattern()."""

    __slots__ = ("text", "min_length", "max_length")

    def __init__(self, text):
        self.text = text  # canonical form: letters a-z, "?" and "*", e.g. "c?t*"
        self.min_length = sum(1 for symbol in text if symbol != ANY_RUN)
        # None when the pattern contains a star and so has no upper bound.
        self.max_length = None if ANY_RUN in text else len(text)

    def matches(self, word):
        """True when word (already normalised, as stored) fits this pattern."""
        if len(word) < self.min_length:
            return False
        symbols = self.text
        if self.max_length is not None:
            return len(word) == self.max_length and all(
                s == ANY_LETTER or s == ch for s, ch in zip(symbols, word))
        # Greedy scan. When the next symbol can't take the next letter, go back
        # to the most recent star and let it swallow one more letter.
        p = w = 0
        star, resume = -1, 0
        while w < len(word):
            if p < len(symbols) and (symbols[p] == ANY_LETTER or symbols[p] == word[w]):
                p += 1
                w += 1
            elif p < len(symbols) and symbols[p] == ANY_RUN:
                star, resume = p, w
                p += 1
            elif star >= 0:
                resume += 1
                p, w = star + 1, resume
            else:
                return False
        # Only stars may be left over; they match the empty run.
        while p < len(symbols) and symbols[p] == ANY_RUN:
            p += 1
        return p == len(symbols)

    def __eq__(self, other):
        return isinstance(other, Pattern) and other.text == self.text

    def __hash__(self):
        return hash(self.text)

    def __str__(self):
        return self.text

    def __repr__(self):
        return f"Pattern({self.text!r})"


def parse_pattern(raw):
    """Turn user input into a Pattern. A Pattern is returned unchanged."""
    if isinstance(raw, Pattern):
        return raw
    if not isinstance(raw, str):
        raise PatternError(f"expected a string, got {type(raw).__name__}")
    symbols = []
    for ch in strip_accents(raw.strip()).lower():
        if ch in LETTERS:
            symbols.append(ch)
        elif ch in BLANK_ALIASES:
            symbols.append(ANY_LETTER)
        elif ch == ANY_RUN:
            if not symbols or symbols[-1] != ANY_RUN:
                symbols.append(ANY_RUN)
        elif ch not in IGNORED:
            raise PatternError(f"{raw!r}: {ch!r} is not allowed in a pattern")
    if not symbols:
        raise PatternError(f"{raw!r}: pattern is empty")
    if len(symbols) > MAX_SYMBOLS:
        raise PatternError(f"{raw!r}: patterns are limited to {MAX_SYMBOLS} symbols")
    return Pattern("".join(symbols))
