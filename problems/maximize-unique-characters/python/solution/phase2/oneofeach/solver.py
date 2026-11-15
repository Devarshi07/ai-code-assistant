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

    Backtracking: try every set of mutually compatible words, extending a
    board only with words that come later alphabetically and share no
    letter with it, and keep the best board seen.
    """
    pool = sorted(playable_words(words), key=lambda word: word.text)
    best_total, best_words = 0, []
    chosen = []

    def search(start, used, total):
        nonlocal best_total, best_words
        if total > best_total or (total == best_total and chosen < best_words):
            best_total, best_words = total, list(chosen)
        for i in range(start, len(pool)):
            word = pool[i]
            if word.mask & used:
                continue
            chosen.append(word.text)
            search(i + 1, used | word.mask, total + word.length)
            chosen.pop()

    search(0, 0, 0)
    return Selection(best_words, best_total)
