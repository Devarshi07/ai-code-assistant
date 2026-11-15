import unittest

from fifteens import Match, find_combinations, parse_hand, score_hand

PLAYERS = ["Ana", "Ben", "Cy"]


def names(cards):
    return [str(card) for card in cards]


def listed(combos):
    return [names(combo) for combo in combos]


def assert_valid_combinations(test, cards, target, combos):
    """Checks every listed combination without trusting the code under test.

    Each combination must use cards from the hand, in hand order, and add up
    to the target. The list must have no repeats and must be sorted by card
    positions in dictionary order. (Needs a hand without repeated cards.)
    """
    position = {card: i for i, card in enumerate(cards)}
    test.assertEqual(len(position), len(cards), "checker needs a hand without repeated cards")
    seen = []
    for combo in combos:
        test.assertTrue(combo, "a combination must hold at least one card")
        for card in combo:
            test.assertIn(card, position, f"{card} is not in the hand")
        index = [position[card] for card in combo]
        test.assertEqual(index, sorted(set(index)), f"{names(combo)} is not in hand order")
        test.assertEqual(sum(card.value for card in combo), target, f"{names(combo)} doesn't add up to {target}")
        seen.append(index)
    test.assertEqual(len(set(map(tuple, seen))), len(seen), "a combination is listed twice")
    test.assertEqual(seen, sorted(seen), "combinations are not in dictionary order of positions")


class FindCombinationsTests(unittest.TestCase):
    def test_two_card_fifteen(self):
        self.assertEqual(listed(find_combinations(parse_hand("5H 10S"))), [["5H", "10S"]])

    def test_five_card_fifteen(self):
        cards = parse_hand("AC 2D 3H 4S 5C")
        self.assertEqual(listed(find_combinations(cards)), [["AC", "2D", "3H", "4S", "5C"]])

    def test_two_fives_count_separately(self):
        combos = find_combinations(parse_hand("JH 5D 5S QC"))
        self.assertEqual(listed(combos), [["JH", "5D"], ["JH", "5S"], ["5D", "QC"], ["5S", "QC"]])

    def test_combinations_are_listed_in_position_order(self):
        cards = parse_hand("7C 2D 6H 8S AD 5C")
        self.assertEqual(listed(find_combinations(cards)), [
            ["7C", "2D", "6H"],
            ["7C", "2D", "AD", "5C"],
            ["7C", "8S"],
            ["2D", "8S", "5C"],
            ["6H", "8S", "AD"],
        ])

    def test_mixed_sizes_with_repeated_ranks(self):
        cards = parse_hand("9S 6D 3C 3H AS 2D")
        self.assertEqual(listed(find_combinations(cards)), [
            ["9S", "6D"],
            ["9S", "3C", "3H"],
            ["9S", "3C", "AS", "2D"],
            ["9S", "3H", "AS", "2D"],
            ["6D", "3C", "3H", "AS", "2D"],
        ])

    def test_a_card_typed_twice_counts_twice(self):
        self.assertEqual(listed(find_combinations(parse_hand("8C 7H 8C"))), [["8C", "7H"], ["7H", "8C"]])

    def test_other_targets(self):
        self.assertEqual(listed(find_combinations(parse_hand("KD 4C 6H 10S"), 10)), [["KD"], ["4C", "6H"], ["10S"]])
        self.assertEqual(listed(find_combinations(parse_hand("3S 3D 9C 6H"), 21)), [["3S", "3D", "9C", "6H"]])

    def test_nothing_adds_up(self):
        self.assertEqual(find_combinations(parse_hand("KC QD JH")), [])
        self.assertEqual(find_combinations([]), [])
        self.assertEqual(find_combinations(parse_hand("5H 10S"), 0), [], "only non-empty combinations count")
        self.assertEqual(find_combinations(parse_hand("5H 10S"), -5), [])

    def test_eight_card_hand(self):
        cards = parse_hand("4H 6C 5D 5S JC AH 9D 3S")
        combos = find_combinations(cards)
        self.assertEqual(len(combos), 11)
        assert_valid_combinations(self, cards, 15, combos)

    def test_sixteen_card_practice_hand(self):
        cards = parse_hand("5C 2C QS 6S 7H AC 3S 3H QC AD JC 7D QD 6H 2S AH")
        combos = find_combinations(cards)
        self.assertEqual(len(combos), 205)
        assert_valid_combinations(self, cards, 15, combos)

    def test_returns_the_hand_cards(self):
        cards = parse_hand("6C 4D 5H 9S AC")
        combos = find_combinations(cards)
        self.assertEqual(listed(combos), [["6C", "4D", "5H"], ["6C", "9S"], ["5H", "9S", "AC"]])
        self.assertEqual(combos[1], [cards[0], cards[3]])


class ScoreHandTests(unittest.TestCase):
    def test_famous_twenty_eight_hand(self):
        score = score_hand(parse_hand("5C 5D 5H JS 5S"))
        self.assertEqual((len(score.fifteens), len(score.pairs), score.runs), (8, 6, []))
        self.assertEqual(score.total, 28)

    def test_fifteens_of_every_size_score(self):
        score = score_hand(parse_hand("2H 3C 4D 6S KH"))
        self.assertEqual(listed(score.fifteens), [["2H", "3C", "4D", "6S"], ["2H", "3C", "KH"]])
        self.assertEqual(score.total, 7)
        self.assertEqual(score_hand(parse_hand("AC 2D 3H 4S 5C")).total, 7)

    def test_eight_card_hand_total(self):
        score = score_hand(parse_hand("4H 6C 5D 5S JC AH 9D 3S"))
        self.assertEqual((score.fifteen_points, score.pair_points, score.run_points), (22, 2, 4))
        self.assertEqual(score.total, 28)

    def test_seeded_match_standings(self):
        match = Match(PLAYERS, seed=2024)
        self.assertEqual(match.play(5), [("Cy", 31), ("Ana", 24), ("Ben", 22)])
        last = match.rounds[-1]
        self.assertEqual(names(last.hands["Cy"]) + [str(last.turn_up)], ["3C", "AS", "2S", "5D", "4S"])
        self.assertEqual(last.scores["Cy"].total, 7, "A-2-3-4-5 is a five-card fifteen plus a run of five")


if __name__ == "__main__":
    unittest.main()
