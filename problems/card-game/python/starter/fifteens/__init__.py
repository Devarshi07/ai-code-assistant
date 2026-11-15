"""Scoring engine for Fifteens, a casual card game."""
from .cards import Card, CardError, RANKS, SUITS, format_cards, parse_card, parse_hand
from .deck import Deck, DeckError, SeededRandom
from .evaluate import count_combinations, find_combinations, find_pairs, find_runs
from .match import Match, MatchError, RoundResult
from .scoring import Score, describe_score, score_hand

__all__ = [
    "Card", "CardError", "RANKS", "SUITS", "format_cards", "parse_card", "parse_hand",
    "Deck", "DeckError", "SeededRandom",
    "count_combinations", "find_combinations", "find_pairs", "find_runs",
    "Match", "MatchError", "RoundResult",
    "Score", "describe_score", "score_hand",
]
