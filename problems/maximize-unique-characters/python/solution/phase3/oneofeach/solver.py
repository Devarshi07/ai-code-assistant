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

    1. Keep one spelling per letter set (anagrams are interchangeable), and
       keep the alphabetically first one so the tie-break is unaffected.
    2. Branch and bound, longest words first, finds the best total.
    3. A second search in alphabetical order stops at the first board that
       reaches that total. Alphabetical depth-first order visits boards in
       tie-break order, so that board is the answer.
    """
    first_spelling = {}
    for word in playable_words(words):
        current = first_spelling.get(word.mask)
        if current is None or word.text < current:
            first_spelling[word.mask] = word.text
    entries = list(first_spelling.items())
    target = _best_total(sorted(entries, key=lambda entry: (-len(entry[1]), entry[1])))
    board = _first_board(sorted(entries, key=lambda entry: entry[1]), target)
    return Selection(board, target)


def _reach(masks, candidates):
    """reach[p] is every letter that candidates[p:] could still add to the board."""
    reach = [0] * (len(candidates) + 1)
    for p in range(len(candidates) - 1, -1, -1):
        reach[p] = reach[p + 1] | masks[candidates[p]]
    return reach


def _best_total(entries):
    """Most letters any board can cover. entries are (mask, text) pairs."""
    masks = [mask for mask, _ in entries]
    sizes = [len(text) for _, text in entries]
    best = 0

    def grow(candidates, total):
        # candidates: indexes of words that fit the current board, in search order.
        nonlocal best
        best = max(best, total)
        reach = _reach(masks, candidates)
        for p, i in enumerate(candidates):
            if total + reach[p].bit_count() <= best:
                return  # even every remaining letter could not beat the best board
            mask = masks[i]
            grow([j for j in candidates[p + 1:] if not masks[j] & mask], total + sizes[i])

    grow(list(range(len(entries))), 0)
    return best


def _first_board(entries, target):
    """First board, in alphabetical depth-first order, that covers target letters."""
    masks = [mask for mask, _ in entries]
    texts = [text for _, text in entries]
    chosen = []

    def extend(candidates, total):
        if total == target:
            return True
        reach = _reach(masks, candidates)
        for p, i in enumerate(candidates):
            if total + reach[p].bit_count() < target:
                return False
            mask = masks[i]
            chosen.append(texts[i])
            if extend([j for j in candidates[p + 1:] if not masks[j] & mask], total + len(texts[i])):
                return True
            chosen.pop()
        return False

    extend(list(range(len(entries))), 0)
    return chosen
