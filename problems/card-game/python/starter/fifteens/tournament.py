"""Tournament marathon mode.

In tournament finals the cards are not dealt into small hands. A marathon
hand of up to a full deck is spread face up and the table calls bonus
targets such as 15, 31 or 100. For every target the scoreboard shows how
many combinations of cards (by position, as everywhere else) add up to it.
Only the counts are needed; nobody wants the combinations listed.
"""
from .cards import format_cards
from .evaluate import FIFTEEN, count_combinations

# Marathon hands come from a single deck.
MAX_MARATHON_CARDS = 52
MAX_TARGET = 200


def marathon_counts(cards, targets=(FIFTEEN,)):
    """Map each target to the number of combinations of cards adding up to it."""
    if len(cards) > MAX_MARATHON_CARDS:
        raise ValueError(f"a marathon hand has at most {MAX_MARATHON_CARDS} cards")
    for target in targets:
        if not 1 <= target <= MAX_TARGET:
            raise ValueError(f"targets must be between 1 and {MAX_TARGET}")
    return {target: count_combinations(cards, target) for target in targets}


def format_marathon(cards, counts) -> str:
    lines = [f"Marathon hand ({len(cards)} cards): {format_cards(cards[:8])}{' ...' if len(cards) > 8 else ''}"]
    for target, count in counts.items():
        lines.append(f"  target {target:>3}: {count:,} combinations")
    return "\n".join(lines)
