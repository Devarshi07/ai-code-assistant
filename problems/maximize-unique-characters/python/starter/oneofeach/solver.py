"""Suggests boards: the best set of candidate words for a puzzle."""
from .models import Selection, as_words


def playable_words(words):
    """Candidates that could appear on a board at all, one per spelling.

    Words that repeat a letter are dropped, and so are exact duplicates
    (the same word often appears in several themes). Order is preserved.
    """
    seen = set()
    playable = []
    for word in as_words(words):
        if word.has_repeats or word.text in seen:
            continue
        seen.add(word.text)
        playable.append(word)
    return playable


def best_selection(words) -> Selection:
    """The board that covers the most letters without repeating any.

    Returns Selection(words, total): the chosen words in alphabetical order
    and the number of letters they cover. Ties go to the alphabetically
    first word list.
    """
    raise NotImplementedError("Phase 2: best_selection is not implemented yet")
