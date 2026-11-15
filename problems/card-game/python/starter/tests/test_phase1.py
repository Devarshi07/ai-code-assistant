import unittest

from fifteens import CardError, Deck, DeckError, Match, find_pairs, find_runs, parse_card, parse_hand, score_hand

PLAYERS = ["Ana", "Ben", "Cy"]


def names(cards):
    return [str(card) for card in cards]


def dealt_cards(result):
    """Every card on the table in a round: all hands plus the turn-up."""
    cards = [card for hand in result.hands.values() for card in hand]
    return cards + [result.turn_up]


class CardTests(unittest.TestCase):
    def test_parses_tens_and_face_cards(self):
        ten = parse_card("10H")
        self.assertEqual((ten.rank, ten.suit, ten.value), ("10", "H", 10))
        self.assertEqual(str(parse_card("qs")), "QS")
        self.assertEqual(str(parse_card(" ac ")), "AC")
        self.assertEqual(str(parse_card("TD")), "10D")

    def test_counting_values_and_rank_order(self):
        cards = parse_hand("AC 7D 10S JH QC KD")
        self.assertEqual([card.value for card in cards], [1, 7, 10, 10, 10, 10])
        self.assertEqual([card.order for card in cards], [1, 7, 10, 11, 12, 13])

    def test_rejects_unknown_cards(self):
        for text in ["1H", "11S", "5X", "Z", ""]:
            with self.assertRaises(CardError, msg=text):
                parse_card(text)

    def test_parse_hand_keeps_order_and_accepts_commas(self):
        self.assertEqual(names(parse_hand("5H, 5S JD,QC")), ["5H", "5S", "JD", "QC"])


class ScoringTests(unittest.TestCase):
    def test_pairs_score_two_points_each(self):
        cards = parse_hand("7H 7S 7D 2C")
        self.assertEqual([names(pair) for pair in find_pairs(cards)], [["7H", "7S"], ["7H", "7D"], ["7S", "7D"]])
        self.assertEqual(score_hand(cards).total, 6)

    def test_runs_score_one_point_per_rank(self):
        self.assertEqual(find_runs(parse_hand("9C 10D JH QS KD")), [["9", "10", "J", "Q", "K"]])
        self.assertEqual(find_runs(parse_hand("3C 4D 4H 5S 9C")), [["3", "4", "5"]])
        self.assertEqual(find_runs(parse_hand("QC KD AH 2S")), [], "runs don't wrap from king to ace")

    def test_face_cards_make_fifteen_with_a_five(self):
        score = score_hand(parse_hand("KH 5D"))
        self.assertEqual([names(combo) for combo in score.fifteens], [["KH", "5D"]])
        self.assertEqual(score.total, 2)

    def test_mixed_hand_breakdown(self):
        score = score_hand(parse_hand("QD 3S 4H 5C 5S"))
        self.assertEqual((score.fifteen_points, score.pair_points, score.run_points), (4, 2, 3))
        self.assertEqual(score.total, 9)


class DeckTests(unittest.TestCase):
    def test_new_deck_holds_all_52_cards(self):
        deck = Deck(seed=1)
        self.assertEqual(len(deck), 52)
        cards = deck.deal(52)
        self.assertEqual(len(set(cards)), 52)
        self.assertEqual(names(cards[:3]), ["AC", "2C", "3C"], "an unshuffled deck is in fresh-deck order")
        with self.assertRaises(DeckError):
            deck.deal(1)

    def test_dealt_cards_leave_the_deck(self):
        deck = Deck(seed=5)
        deck.shuffle()
        hand = deck.deal(5)
        self.assertEqual(len(deck), 47)
        self.assertFalse(set(hand) & set(deck.peek()), "a dealt card is still in the deck")

    def test_reset_brings_every_card_back(self):
        deck = Deck(seed=8)
        deck.shuffle()
        deck.deal(20)
        deck.reset()
        self.assertEqual(len(deck), 52)
        self.assertEqual(len(set(deck.peek())), 52)

    def test_seeded_shuffle_matches_the_replay_log(self):
        deck = Deck(seed=42)
        deck.shuffle()
        self.assertEqual(names(deck.deal(6)), ["5H", "9S", "9C", "JS", "3C", "2D"])

    def test_same_seed_gives_the_same_deal(self):
        first, second = Deck(seed=7), Deck(seed=7)
        first.shuffle()
        second.shuffle()
        self.assertEqual(names(first.deal(5)), names(second.deal(5)))


class MatchTests(unittest.TestCase):
    def test_round_deals_distinct_cards(self):
        result = Match(PLAYERS, seed=3).play_round()
        cards = dealt_cards(result)
        self.assertEqual([len(hand) for hand in result.hands.values()], [4, 4, 4])
        self.assertEqual(len(set(cards)), 13, "the same card was dealt twice in one round")

    def test_first_rounds_match_the_replay_log(self):
        match = Match(["Ana", "Ben"], seed=4412)
        first = match.play_round()
        self.assertEqual(names(first.hands["Ana"]), ["KH", "3C", "10C", "6S"])
        self.assertEqual(names(first.hands["Ben"]), ["8C", "7C", "8D", "8H"])
        self.assertEqual(str(first.turn_up), "5D")
        second = match.play_round()
        self.assertEqual(names(second.hands["Ana"]), ["4C", "2S", "7S", "JH"])
        self.assertEqual(names(second.hands["Ben"]), ["6C", "AH", "JS", "9H"])
        self.assertEqual(str(second.turn_up), "4H")

    def test_long_match_uses_the_full_deck_every_round(self):
        match = Match(PLAYERS, seed=11)
        match.play(8)
        self.assertEqual(len(match.rounds), 8)
        for result in match.rounds:
            self.assertEqual(len(set(dealt_cards(result))), 13, f"round {result.number} reused a card")
        self.assertEqual(sum(match.totals.values()),
                         sum(score.total for result in match.rounds for score in result.scores.values()))

    def test_replaying_a_seed_reproduces_the_match(self):
        original = Match(PLAYERS, seed=2024)
        original.play(3)
        replay = Match(PLAYERS, seed=2024)
        replay.play(3)
        for before, after in zip(original.rounds, replay.rounds):
            for name in PLAYERS:
                self.assertEqual(names(before.hands[name]), names(after.hands[name]), f"round {before.number}, {name}")
            self.assertEqual(before.turn_up, after.turn_up)
        self.assertEqual(original.standings(), replay.standings())


if __name__ == "__main__":
    unittest.main()
