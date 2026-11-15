"""A standard 52-card deck with reproducible shuffles.

Every match stores its seed. Support's replay tool rebuilds a disputed match
from that seed, so a given seed must always produce the same deals, on the
server and in the JavaScript client alike. That is why the deck uses its own
small generator instead of the ``random`` module.
"""
from .cards import RANKS, SUITS, Card

# Fresh-deck order: clubs, diamonds, hearts, spades; ace to king in each suit.
STANDARD_ORDER = [Card(rank, suit) for suit in SUITS for rank in RANKS]


class DeckError(RuntimeError):
    """Raised when more cards are requested than the deck holds."""


class SeededRandom:
    """32-bit linear congruential generator (Numerical Recipes constants).

    The JavaScript client implements the same arithmetic, so both produce the
    same sequence for the same seed.
    """

    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF

    def next_uint32(self) -> int:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state

    def below(self, n: int) -> int:
        """An integer in [0, n), taken from the high bits of the next value."""
        return (self.next_uint32() * n) >> 32


class Deck:
    """The cards not yet dealt, top of the deck first."""

    def __init__(self, seed=0):
        self.seed = seed
        self._rng = SeededRandom(seed)
        self.reset()

    def reset(self):
        """Gather all 52 cards back into the deck, in fresh-deck order."""
        self._cards = list(STANDARD_ORDER)

    def shuffle(self):
        """Fisher-Yates shuffle of the cards currently in the deck."""
        cards = self._cards
        for i in range(len(cards) - 1, 0, -1):
            j = self._rng.below(i + 1)
            cards[i], cards[j] = cards[j], cards[i]

    def deal(self, count=1):
        """Remove ``count`` cards from the top of the deck and return them."""
        if count > len(self._cards):
            raise DeckError(f"cannot deal {count} card(s), only {len(self._cards)} left")
        dealt = self._cards[:count]
        del self._cards[:count]
        return dealt

    def peek(self):
        """The cards still in the deck, top first (a copy)."""
        return list(self._cards)

    def __len__(self):
        return len(self._cards)

    def __repr__(self):
        return f"Deck(seed={self.seed}, {len(self)} cards left)"
