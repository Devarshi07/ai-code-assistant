import time
import unittest

from fifteens import RANKS, SUITS, count_combinations, find_combinations, parse_hand

# Every expected count in this file was checked two independent ways:
# enumerating all subsets (for the hands of up to 18 cards) and summing
# binomial coefficients over how many cards of each value are used.

FULL_DECK = parse_hand(" ".join(rank + suit for suit in SUITS for rank in RANKS))
MARATHON_40 = parse_hand(
    "2D 2H 9D KH 10C 8S JH 4C 3H 9H 6D 2S KD 10S 3C 7D 6C QH 7C 9C "
    "QS 4D 10D 2C 4S 5C 6S JD 10H 4H 3S KS KC AC AS JS 5S 3D 5D 7H")
MARATHON_30 = parse_hand(
    "3D QH 4C KC KH JD 2D 10S 6H 3H QS 9C 9H JC 6S JH 4S 8S 3S 3C "
    "AS 5S QC 2C 2H 8C 5D JS QD 5H")

MEDIUM_HANDS = [
    ("7D 3S 8H 5S 9D KC AC 9H 7C 10H AD 3D", {15: 25, 21: 64, 31: 119, 40: 124}),
    ("KH 4H KD KS 10S 9D 6D QD JD 10C 6H QH 5D 5S", {15: 22, 21: 35, 31: 137, 40: 422}),
    ("JS JD KD 8S QD KH AC 8D 4H 5H QS 2H JC 10S 7S 9S", {15: 25, 21: 79, 31: 291, 40: 723}),
    ("6C 5S 9S KS 3H 6D 8C 8H JS 10C KD 9D AH QH 2H KC 5C 8S", {15: 47, 21: 175, 31: 773, 40: 2078}),
    # A practice-mode hand with repeated cards: every position counts.
    ("5H 5H 10S 5H JD AC AC 4S 6D 6D 9C 5H KS 2C", {15: 64, 21: 199, 31: 453, 40: 459}),
]

# One tournament round: the targets called at the table, in order.
MARATHON_ROUND = [
    (FULL_DECK, 15, 17_264),
    (FULL_DECK, 25, 746_736),
    (FULL_DECK, 31, 5_011_024),
    (FULL_DECK, 100, 1_864_192_096_504),
    (FULL_DECK, 170, 68_141_176_483_932),
    (FULL_DECK, 200, 35_865_475_414_775),
    (MARATHON_40, 77, 1_471_665_517),
    (MARATHON_30, 120, 12_473_861),
]
ROUND_BUDGET = 0.25  # seconds for the whole round


class CountCombinationsTests(unittest.TestCase):
    def test_count_matches_the_listing_on_normal_hands(self):
        for text in ["JH 5D 5S QC", "7C 2D 6H 8S AD 5C", "4H 6C 5D 5S JC AH 9D 3S"]:
            cards = parse_hand(text)
            self.assertEqual(count_combinations(cards), len(find_combinations(cards)), text)
        self.assertEqual(count_combinations(parse_hand("KD 4C 6H 10S"), 10), 3)

    def test_medium_hands_match_brute_force(self):
        for text, expected in MEDIUM_HANDS:
            cards = parse_hand(text)
            for target, count in expected.items():
                with self.subTest(hand=text, target=target):
                    self.assertEqual(count_combinations(cards, target), count)

    def test_edge_cases(self):
        fives = parse_hand("5H 5H 5H 5H")
        self.assertEqual([count_combinations(fives, t) for t in (5, 10, 15, 20, 25)], [4, 6, 4, 1, 0])
        self.assertEqual(count_combinations([], 15), 0)
        self.assertEqual(count_combinations(parse_hand("KH"), 10), 1)
        self.assertEqual(count_combinations(parse_hand("5H 10S"), 0), 0, "the empty combination never counts")
        self.assertEqual(count_combinations(parse_hand("5H 10S"), -4), 0)

    def test_marathon_round_is_fast_and_exact(self):
        start = time.perf_counter()
        for cards, target, expected in MARATHON_ROUND:
            count = count_combinations(cards, target)
            elapsed = time.perf_counter() - start
            # Checked after every call, so a slow solution fails quickly
            # instead of running for hours on the bigger targets.
            self.assertLess(elapsed, ROUND_BUDGET,
                            f"took {elapsed:.2f}s to get through target {target} ({len(cards)} cards); "
                            f"the whole marathon round must finish in under {ROUND_BUDGET}s")
            self.assertEqual(count, expected, f"{len(cards)}-card hand, target {target}")


if __name__ == "__main__":
    unittest.main()
