"""Scoring rules for Fifteens.

    fifteens   2 points for every combination of cards adding up to 15
    pairs      2 points for every two cards of the same rank
    runs       1 point per rank in each run of three or more consecutive ranks

During a match a player's hand is scored together with the round's turn-up
card, so a four-card hand is scored as five cards.
"""
from typing import List, NamedTuple

from .cards import format_cards
from .evaluate import FIFTEEN, find_combinations, find_pairs, find_runs

POINTS_PER_FIFTEEN = 2
POINTS_PER_PAIR = 2
POINTS_PER_RUN_RANK = 1


class Score(NamedTuple):
    """What a hand scored, with the patterns behind each part of the score."""
    fifteens: List[list]    # card combinations adding up to 15
    pairs: List[list]       # [card, card] pairs of the same rank
    runs: List[List[str]]   # runs as rank symbols, e.g. ["3", "4", "5"]

    @property
    def fifteen_points(self) -> int:
        return POINTS_PER_FIFTEEN * len(self.fifteens)

    @property
    def pair_points(self) -> int:
        return POINTS_PER_PAIR * len(self.pairs)

    @property
    def run_points(self) -> int:
        return POINTS_PER_RUN_RANK * sum(len(run) for run in self.runs)

    @property
    def total(self) -> int:
        return self.fifteen_points + self.pair_points + self.run_points


def score_hand(cards) -> Score:
    """Score a hand (including the turn-up card, if there is one)."""
    return Score(fifteens=find_combinations(cards, FIFTEEN), pairs=find_pairs(cards), runs=find_runs(cards))


def describe_score(score: Score) -> str:
    """One-line summary for the table view, e.g. '8 pts: 15s x2, pair x1, run 3-4-5'."""
    parts = []
    if score.fifteens:
        parts.append(f"15s x{len(score.fifteens)}")
    if score.pairs:
        parts.append(f"pair x{len(score.pairs)}")
    for run in score.runs:
        parts.append("run " + "-".join(run))
    return f"{score.total} pts" + (": " + ", ".join(parts) if parts else "")


def describe_fifteens(score: Score) -> str:
    """The fifteens spelled out, e.g. '5H+JD, 5H+QC'."""
    return ", ".join(format_cards(combo).replace(" ", "+") for combo in score.fifteens)
