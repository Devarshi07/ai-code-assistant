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


def find_combinations(cards, target=FIFTEEN):
    """Every combination of one or more cards whose values add up to target.

    Each combination lists its cards in hand order. Combinations are ordered
    by the positions of their cards, compared like words in a dictionary.

    Depth-first search over positions: the next card added always sits to
    the right of the last one, which yields combinations in exactly that
    dictionary order. Card values are positive, so a branch stops as soon as
    its total reaches the target.
    """
    values = [card.value for card in cards]
    found = []
    chosen = []

    def extend(start, total):
        for i in range(start, len(cards)):
            new_total = total + values[i]
            if new_total > target:
                continue
            chosen.append(i)
            if new_total == target:
                found.append([cards[j] for j in chosen])
            else:
                extend(i + 1, new_total)
            chosen.pop()

    if target > 0:
        extend(0, 0)
    return found


def count_combinations(cards, target=FIFTEEN):
    """How many combinations of cards add up to target.

    Subset-sum counting instead of listing: ``ways[t]`` is the number of
    combinations of the cards seen so far that add up to ``t``. Each new card
    either stays out or joins a combination worth ``t - value``. Totals are
    updated from high to low so a card is never used twice in one pass.
    O(len(cards) * target) time and O(target) memory.
    """
    if target <= 0:
        return 0
    ways = [1] + [0] * target   # ways[0] = 1: the empty combination, never counted itself
    for card in cards:
        value = card.value
        for total in range(target, value - 1, -1):
            ways[total] += ways[total - value]
    return ways[target]
