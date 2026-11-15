"""Letter-set helpers shared by the whole package.

A word's letters are stored as a 26-bit mask: bit 0 is 'a', bit 25 is 'z'.
Masks make the puzzle rule cheap to check, because two words share a letter
exactly when ``a & b`` is non-zero.

    >>> mask_letters(letter_mask("tango"))
    'agnot'
"""

ALPHABET = "abcdefghijklmnopqrstuvwxyz"
FULL_MASK = (1 << len(ALPHABET)) - 1


class WordError(ValueError):
    """Raised for text that cannot be used as a puzzle word."""


def normalize_word(raw):
    """Trim and lower-case a word. Anything except the letters a-z is rejected."""
    word = raw.strip().lower()
    if not word:
        raise WordError("empty word")
    bad = sorted({ch for ch in word if ch not in ALPHABET})
    if bad:
        raise WordError(f"{raw.strip()!r} contains {''.join(bad)!r}; only a-z are allowed")
    return word


def letter_bit(ch):
    """The mask bit for a single lower-case letter."""
    return 1 << (ord(ch) - ord("a"))


def letter_mask(word):
    """Bitmask of the distinct letters in a normalized word."""
    mask = 0
    for ch in word:
        mask |= letter_bit(ch)
    return mask


def popcount(mask):
    """Number of letters in a mask."""
    return bin(mask).count("1")


def mask_letters(mask):
    """The letters in a mask, alphabetically: mask_letters(letter_mask('otter')) == 'eort'."""
    return "".join(ch for i, ch in enumerate(ALPHABET) if mask >> i & 1)


def shared_letters(a, b):
    """Letters present in both masks, alphabetically."""
    return mask_letters(a & b)
