"""Hand evaluation: finds the card patterns that the scoring rules pay for.

Every function takes a list of cards and works by *position* in that list.
Two different fives are two different cards, and so is the same card typed
twice in practice mode. Nothing in this module awards points; scoring.py
turns these patterns into a score.
"""
from itertools import combinations

from .cards import RANKS

FIFTEEN = 15
MIN_RUN = 3


def find_pairs(cards):
    """Every two cards of the same rank, as ``[first, second]`` in hand order."""
    return [[a, b] for a, b in combinations(cards, 2) if a.rank == b.rank]


def find_runs(cards):
    """Runs of three or more consecutive ranks, aces low, kings high, no wrap.

    Each run is reported once, as rank symbols from lowest to highest, and is
    as long as possible. Repeated ranks don't make extra runs, so
    3-4-4-5 holds a single run of three.
    """
    present = sorted({card.order for card in cards})
    runs, current = [], []
    for order in present:
        if current and order != current[-1] + 1:
            if len(current) >= MIN_RUN:
                runs.append(current)
            current = []
        current.append(order)
    if len(current) >= MIN_RUN:
        runs.append(current)
    return [[RANKS[order - 1] for order in run] for run in runs]


def small_fifteens(cards):
    """Two- and three-card combinations worth fifteen, in hand order.

    This is the shortcut the v1 scorer shipped with. It misses fifteens that
    need four or more cards, such as A-2-3-4-5 or 2-3-4-6.
    """
    found = []
    for i in range(len(cards)):
        for j in range(i + 1, len(cards)):
            pair_total = cards[i].value + cards[j].value
            if pair_total == FIFTEEN:
                found.append([cards[i], cards[j]])
            for k in range(j + 1, len(cards)):
                if pair_total + cards[k].value == FIFTEEN:
                    found.append([cards[i], cards[j], cards[k]])
    return found


def find_combinations(cards, target=FIFTEEN):
    """Every combination of one or more cards whose values add up to target.

    Each combination lists its cards in hand order. Combinations are ordered
    by the positions of their cards, compared like words in a dictionary.
    """
    raise NotImplementedError("Phase 2: find_combinations is not implemented yet")


def count_combinations(cards, target=FIFTEEN):
    """How many combinations of cards add up to target."""
    return len(find_combinations(cards, target))
