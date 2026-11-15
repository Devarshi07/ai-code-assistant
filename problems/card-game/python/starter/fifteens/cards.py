"""Playing-card models and the text notation used across the app.

Cards are written rank first, then suit: ``"AC"`` is the ace of clubs,
``"10H"`` the ten of hearts and ``"QS"`` the queen of spades. ``"T"`` is
accepted for ten because some older clients still send it. Hands travel as
space- or comma-separated strings such as ``"5H 5S JD QC"``.
"""
from typing import List, NamedTuple

RANKS = ("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")
SUITS = ("C", "D", "H", "S")
SUIT_NAMES = {"C": "clubs", "D": "diamonds", "H": "hearts", "S": "spades"}

# Jacks, queens and kings are worth ten when counting fifteens.
FACE_VALUE = 10


class CardError(ValueError):
    """Raised for card text the parser doesn't understand."""


class Card(NamedTuple):
    rank: str
    suit: str

    @property
    def order(self) -> int:
        """Rank order used for runs and sorting: A=1, 2-10, J=11, Q=12, K=13."""
        return RANKS.index(self.rank) + 1

    @property
    def value(self) -> int:
        """Counting value for fifteens: A=1, number cards at face value, J/Q/K=10."""
        return min(self.order, FACE_VALUE)

    @property
    def name(self) -> str:
        return f"{self.rank} of {SUIT_NAMES[self.suit]}"

    def __str__(self):
        return self.rank + self.suit


def parse_card(text: str) -> Card:
    """Parse one card such as ``"10H"``, ``"qs"`` or ``"AC"``."""
    token = text.strip().upper()
    rank, suit = token[:-1], token[-1:]
    if rank == "T":
        rank = "10"
    if rank not in RANKS or suit not in SUITS:
        raise CardError(f"not a card: {text!r}")
    return Card(rank, suit)


def parse_hand(text: str) -> List[Card]:
    """Parse a hand written as ``"5H 5S JD"`` or ``"5H,5S,JD"``.

    The order of the cards is kept: it is the order the player sees them in.
    """
    return [parse_card(token) for token in text.replace(",", " ").split()]


def format_cards(cards) -> str:
    return " ".join(str(card) for card in cards)
