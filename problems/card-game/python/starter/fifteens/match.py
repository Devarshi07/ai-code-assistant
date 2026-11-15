"""Round and match runner used by the game server.

A match seats two to four players around one deck. Every round the dealer
gathers and shuffles all 52 cards, deals the hands one card at a time in
seating order, then turns up one more card. The turn-up counts as part of
every player's hand when the round is scored.
"""
from typing import Dict, List, NamedTuple

from .cards import Card
from .deck import Deck
from .scoring import Score, score_hand

MIN_PLAYERS, MAX_PLAYERS = 2, 4


class MatchError(ValueError):
    """Raised for a match that can't be set up as requested."""


class RoundResult(NamedTuple):
    number: int                  # 1 for the first round of the match
    turn_up: Card
    hands: Dict[str, List[Card]]  # cards each player holds (turn-up not included)
    scores: Dict[str, Score]     # each player's hand scored with the turn-up


class Match:
    def __init__(self, players, seed=0, hand_size=4):
        players = list(players)
        if not MIN_PLAYERS <= len(players) <= MAX_PLAYERS:
            raise MatchError(f"a match needs {MIN_PLAYERS} to {MAX_PLAYERS} players")
        if len(set(players)) != len(players):
            raise MatchError("player names must be unique")
        if hand_size < 1 or len(players) * hand_size + 1 > 52:
            raise MatchError(f"cannot deal {hand_size} cards to {len(players)} players")
        self.players = players
        self.seed = seed
        self.hand_size = hand_size
        self.deck = Deck(seed)
        self.totals = {name: 0 for name in players}
        self.rounds: List[RoundResult] = []

    def deal_round(self):
        """Shuffle the full deck and deal. Returns ``(hands, turn_up)``."""
        self.deck.reset()
        self.deck.shuffle()
        hands = {name: [] for name in self.players}
        for _ in range(self.hand_size):
            for name in self.players:
                hands[name].extend(self.deck.deal(1))
        turn_up = self.deck.deal(1)[0]
        return hands, turn_up

    def play_round(self) -> RoundResult:
        hands, turn_up = self.deal_round()
        scores = {name: score_hand(hand + [turn_up]) for name, hand in hands.items()}
        for name, score in scores.items():
            self.totals[name] += score.total
        result = RoundResult(len(self.rounds) + 1, turn_up, hands, scores)
        self.rounds.append(result)
        return result

    def play(self, rounds):
        """Play ``rounds`` more rounds and return the standings."""
        for _ in range(rounds):
            self.play_round()
        return self.standings()

    def standings(self):
        """``(name, total)`` pairs, highest total first; ties keep seating order."""
        return sorted(self.totals.items(), key=lambda item: -item[1])
