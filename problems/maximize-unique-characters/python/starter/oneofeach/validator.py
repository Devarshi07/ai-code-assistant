"""Checks a board against the puzzle rules before it is published.

The rules of One of Each:
  1. a word may not use any letter twice ('otter' is out);
  2. no letter may appear in more than one word on the board.
"""
from .letters import mask_letters
from .models import as_words


def selection_problems(words):
    """Return human-readable rule violations for a board; empty when it is valid."""
    words = as_words(words)
    problems = []
    used = 0
    placed = []
    for word in words:
        if word.has_repeats:
            doubled = "".join(ch for ch in word.letters if word.text.count(ch) > 1)
            problems.append(f"{word.text!r} uses {doubled!r} more than once")
        clash = used & word.mask
        if clash:
            others = ", ".join(repr(other.text) for other in placed if other.mask & clash)
            problems.append(f"{word.text!r} shares {mask_letters(clash)!r} with {others}")
        used |= word.mask
        placed.append(word)
    return problems


def is_valid_selection(words):
    return not selection_problems(words)
