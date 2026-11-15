"""Splits note text into words, keeping each word's character offsets.

The editor draws its red underline from the offsets reported here, so every
token must point at exactly the characters it came from in the note.

Rules
    - A word is a run of letters. An apostrophe with a letter on both sides
      belongs to the word, so contractions and possessives stay whole:
      don't, o'clock, team's.
    - Quotes, hyphens, dashes, slashes and other punctuation separate words.
      "well-known" is checked as "well" and "known"; 'draft' is just draft.
    - Runs that contain a digit (2024, 3rd, mp3, 10am) are not words and are
      skipped entirely.
"""
from typing import List, NamedTuple

# The ASCII apostrophe, and the typographic one (U+2019) that the mobile
# editor's smart punctuation inserts when the user types '.
APOSTROPHES = "'’"
DIGITS = "0123456789"


class Token(NamedTuple):
    text: str    # the word exactly as written in the note
    start: int   # offset of its first character
    end: int     # offset one past its last character


def _is_word_char(ch):
    return ch.isalpha() or ch in DIGITS


def _joins_word(text, i):
    """True when text[i] is an apostrophe with a letter on each side."""
    return (text[i] in APOSTROPHES and 0 < i < len(text) - 1
            and text[i - 1].isalpha() and text[i + 1].isalpha())


def tokenize(text) -> List[Token]:
    """Every checkable word in text, in order."""
    tokens = []
    i, n = 0, len(text)
    while i < n:
        if not _is_word_char(text[i]):
            i += 1
            continue
        start = i
        while i < n and (_is_word_char(text[i]) or _joins_word(text, i)):
            i += 1
        word = text[start:i]
        if not any(ch in DIGITS for ch in word):
            tokens.append(Token(word, start, i))
    return tokens
