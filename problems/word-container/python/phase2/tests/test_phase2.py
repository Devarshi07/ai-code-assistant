import unittest

from wordstore import PatternError, WordContainer, parse_pattern
from wordstore.loader import load_bundled

SAMPLE = ["cat", "cot", "cut", "cute", "cuts", "coat", "cart", "chart", "comet",
          "act", "at", "a", "scat", "tact", "cactus"]


def fits(pattern, word):
    return parse_pattern(pattern).matches(word)


class PatternMatchesTests(unittest.TestCase):
    def test_question_mark_is_exactly_one_letter(self):
        self.assertTrue(fits("c?t", "cat"))
        self.assertTrue(fits("c?t", "cot"))
        for word in ["ct", "coat", "scat", "cats"]:
            with self.subTest(word=word):
                self.assertFalse(fits("c?t", word))

    def test_star_matches_any_run_including_none(self):
        for word in ["ct", "cat", "chart"]:
            with self.subTest(word=word):
                self.assertTrue(fits("c*t", word))
        self.assertFalse(fits("c*t", "cats"))
        self.assertFalse(fits("c*t", "act"))
        self.assertTrue(fits("*", "a"))
        self.assertTrue(fits("cat*", "cat"))

    def test_stars_can_give_letters_back(self):
        self.assertTrue(fits("*ab", "aab"))
        self.assertTrue(fits("*ab", "abab"))
        self.assertFalse(fits("*ab", "aba"))
        self.assertTrue(fits("a*b*c", "aabbcc"))
        self.assertFalse(fits("a*b*c", "acb"))
        self.assertTrue(fits("*a*a", "banana"))
        self.assertTrue(fits("*s*s*s*", "mississippi"))

    def test_question_marks_and_stars_together(self):
        self.assertFalse(fits("?*?", "a"))
        self.assertTrue(fits("?*?", "ab"))
        self.assertTrue(fits("?*?", "abc"))
        self.assertTrue(fits("ba??na*", "banana"))
        self.assertFalse(fits("ba??na*", "bandana"))
        self.assertFalse(fits("*a*a", "a"))


class ContainerMatchTests(unittest.TestCase):
    def setUp(self):
        self.words = WordContainer(SAMPLE)

    def test_crossword_clue(self):
        self.assertEqual(self.words.match("c?t"), ["cat", "cot", "cut"])

    def test_trailing_star_keeps_alphabetical_order(self):
        self.assertEqual(self.words.match("c?t*"), ["cat", "cot", "cut", "cute", "cuts"])

    def test_stars_anywhere(self):
        self.assertEqual(self.words.match("c*t"), ["cart", "cat", "chart", "coat", "comet", "cot", "cut"])
        self.assertEqual(self.words.match("*at"), ["at", "cat", "coat", "scat"])
        self.assertEqual(self.words.match("*a*t*"),
                         ["act", "at", "cactus", "cart", "cat", "chart", "coat", "scat", "tact"])
        self.assertEqual(self.words.match("*c*c*"), ["cactus"])

    def test_whole_store_and_fixed_lengths(self):
        self.assertEqual(self.words.match("*"), sorted(SAMPLE))
        self.assertEqual(self.words.match("????"), ["cart", "coat", "cute", "cuts", "scat", "tact"])
        self.assertEqual(self.words.match("?"), ["a"])
        self.assertEqual(self.words.match("*t?"), ["cute", "cuts"])

    def test_no_matches(self):
        self.assertEqual(self.words.match("q??"), [])
        self.assertEqual(self.words.match("??????????"), [])

    def test_limit_returns_the_alphabetically_first_matches(self):
        self.assertEqual(self.words.match("c*", 3), ["cactus", "cart", "cat"])
        self.assertEqual(self.words.match("*t", 2), ["act", "at"])
        self.assertEqual(self.words.match("c?t", 0), [])
        self.assertEqual(self.words.match("c?t", 50), ["cat", "cot", "cut"])

    def test_negative_limit_is_rejected(self):
        with self.assertRaises(ValueError):
            self.words.match("c?t", -1)

    def test_patterns_are_normalised(self):
        self.assertEqual(self.words.match("C.T"), ["cat", "cot", "cut"])
        self.assertEqual(self.words.match("c_t"), ["cat", "cot", "cut"])
        self.assertEqual(self.words.match(parse_pattern("C?T")), ["cat", "cot", "cut"])
        self.words.add("Café")
        self.assertEqual(self.words.match("CAF?"), ["cafe"])

    def test_invalid_patterns_raise(self):
        for raw in ["c4t", "", "c+t"]:
            with self.subTest(raw=raw), self.assertRaises(PatternError):
                self.words.match(raw)

    def test_results_follow_additions_and_removals(self):
        self.words.remove("cot")
        self.words.add("KIT")
        self.words.add("Cat")
        self.assertEqual(self.words.match("c?t"), ["cat", "cut"])
        self.assertEqual(self.words.match("?it"), ["kit"])


class BundledListTests(unittest.TestCase):
    def setUp(self):
        self.words = WordContainer()
        load_bundled(self.words)

    def test_solver_panel_searches(self):
        self.assertEqual(self.words.match("b??l"), ["ball", "bell", "boil", "bowl"])
        self.assertEqual(self.words.match("*ball"),
                         ["ball", "baseball", "basketball", "football", "netball", "tball", "volleyball"])
        self.assertEqual(self.words.match("*ing"),
                         ["bowling", "boxing", "curling", "cycling", "diving", "fencing", "king", "rowing", "wing"])
        self.assertEqual(self.words.match("c*e", 6), ["cafe", "cake", "candle", "canoe", "castle", "cave"])

    def test_five_letter_slot(self):
        found = self.words.match("??a??")
        self.assertEqual(len(found), 28)
        self.assertEqual(found[:4], ["alarm", "beach", "blade", "brain"])
        self.assertEqual(found[-3:], ["toast", "train", "whale"])


if __name__ == "__main__":
    unittest.main()
