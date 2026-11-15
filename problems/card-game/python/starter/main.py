"""Plays a seeded five-round match, then scores a few showcase hands."""
from fifteens import Deck, Match, describe_score, format_cards, parse_hand, score_hand
from fifteens.scoring import describe_fifteens
from fifteens.tournament import format_marathon, marathon_counts

SHOWCASE = [
    ("5C 5D 5H JS", "5S"),
    ("AC 2D 3H 4S", "5C"),
    ("2H 3C 4D 6S", "KH"),
]


def print_match():
    match = Match(["Ana", "Ben", "Cy"], seed=2024)
    print(f"Fifteens match, seed {match.seed}: {', '.join(match.players)}")
    for _ in range(5):
        result = match.play_round()
        print(f"\nRound {result.number}   turn-up {result.turn_up}")
        for name, hand in result.hands.items():
            print(f"  {name:<4} {format_cards(hand):<14} {describe_score(result.scores[name])}")
    print("\nStandings")
    for place, (name, total) in enumerate(match.standings(), start=1):
        print(f"  {place}. {name:<4} {total:>3}")


def print_showcase():
    print("\nShowcase hands")
    for hand_text, turn_up in SHOWCASE:
        cards = parse_hand(hand_text) + parse_hand(turn_up)
        score = score_hand(cards)
        print(f"  {hand_text} | {turn_up}   {describe_score(score)}")
        if score.fifteens:
            print(f"    fifteens: {describe_fifteens(score)}")


def print_marathon():
    print()
    full_deck = Deck().deal(52)
    try:
        print(format_marathon(full_deck, marathon_counts(full_deck)))
    except NotImplementedError as exc:
        print(f"Marathon preview: {exc}")


def main():
    print_match()
    print_showcase()
    print_marathon()


if __name__ == "__main__":
    main()
