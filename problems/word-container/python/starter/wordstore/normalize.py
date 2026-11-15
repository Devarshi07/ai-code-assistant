"""Normalisation rules shared by everything that stores or looks up words.

A crossword grid holds one plain letter per square, so the store keeps every
entry in a single canonical form:

1. Surrounding whitespace is removed and letters are lowercased.
2. Accents are stripped: "Café" -> "cafe", "jalapeño" -> "jalapeno".
3. Spaces, hyphens and apostrophes inside an entry are dropped, the way grids
   ignore them: "ice cream" -> "icecream", "o'clock" -> "oclock".
4. What is left must be letters a-z. Digits and other symbols make the entry
   invalid ("r2d2", "24/7"), and so does an entry with no letters at all.
"""
import unicodedata

LETTERS = frozenset("abcdefghijklmnopqrstuvwxyz")
# Characters that grids ignore: space, hyphen, straight and curly apostrophes.
IGNORED = frozenset(" -'’")


class InvalidWord(ValueError):
    """Raised when an entry cannot be stored as a grid word."""


def strip_accents(text):
    """Remove combining marks after compatibility decomposition (é -> e, ﬁ -> fi)."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.category(ch).startswith("M"))


def normalize_word(raw):
    """Return the canonical form of an entry, or raise InvalidWord."""
    if not isinstance(raw, str):
        raise InvalidWord(f"expected a string, got {type(raw).__name__}")
    text = raw.strip()
    if text.isascii() and text.isalpha():
        # Fast path: almost every line of a word list is a plain ASCII word.
        return text.lower()
    letters = []
    for ch in strip_accents(text).lower():
        if ch in LETTERS:
            letters.append(ch)
        elif ch not in IGNORED:
            raise InvalidWord(f"{raw!r}: {ch!r} is not a letter")
    if not letters:
        raise InvalidWord(f"{raw!r}: no letters")
    return "".join(letters)


def normalize_prefix(raw):
    """Like normalize_word, but an empty prefix is allowed and means "every word"."""
    if isinstance(raw, str) and not raw.strip():
        return ""
    return normalize_word(raw)
