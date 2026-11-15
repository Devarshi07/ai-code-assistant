import unittest

from wordstore import InvalidWord, WordContainer, normalize_word
from wordstore.loader import load_bundled, load_text
from wordstore.report import letter_breakdown

# Every bundled list, normalised and de-duplicated, holds this many words.
BUNDLED_TOTAL = 447
BUNDLED_FIRST_LETTERS = {
    "a": 27, "b": 48, "c": 50, "d": 18, "e": 9, "f": 23, "g": 20, "h": 14, "i": 6,
    "j": 14, "k": 10, "l": 15, "m": 18, "n": 10, "o": 9, "p": 31, "q": 3, "r": 24,
    "s": 45, "t": 21, "u": 4, "v": 6, "w": 15, "y": 4, "z": 3,
}


def bundled_store():
    words = WordContainer()
    load_bundled(words)
    return words


class NormalizeTests(unittest.TestCase):
    def test_lowercases_and_strips_accents(self):
        self.assertEqual(normalize_word("Café"), "cafe")
        self.assertEqual(normalize_word("  NAÏVE "), "naive")
        self.assertEqual(normalize_word("Jalapeño"), "jalapeno")

    def test_drops_spaces_hyphens_and_apostrophes(self):
        self.assertEqual(normalize_word("ice cream"), "icecream")
        self.assertEqual(normalize_word("Jiu-Jitsu"), "jiujitsu")
        self.assertEqual(normalize_word("o'clock"), "oclock")
        self.assertEqual(normalize_word("rock ’n’ roll"), "rocknroll")

    def test_rejects_entries_that_are_not_words(self):
        for raw in ["r2d2", "24/7", "c++", "", "   ", "-"]:
            with self.subTest(raw=raw), self.assertRaises(InvalidWord):
                normalize_word(raw)


class WordContainerTests(unittest.TestCase):
    def setUp(self):
        self.words = WordContainer(["cat", "cart", "cot"])

    def test_add_reports_new_and_repeated_words(self):
        self.assertTrue(self.words.add("coat"))
        self.assertFalse(self.words.add("Cat"))
        self.assertEqual(len(self.words), 4)

    def test_lookups_ignore_case_and_accents(self):
        self.assertIn("CAT", self.words)
        self.words.add("Café")
        self.assertIn("cafe", self.words)
        self.assertIn(" CAFÉ ", self.words)
        self.assertNotIn("r2d2", self.words)

    def test_a_prefix_is_not_a_word(self):
        self.assertNotIn("car", self.words)
        self.assertNotIn("ca", self.words)
        self.assertNotIn("carts", self.words)

    def test_iterates_in_alphabetical_order(self):
        self.words.add_all(["act", "cut", "a", "coat"])
        self.assertEqual(list(self.words), ["a", "act", "cart", "cat", "coat", "cot", "cut"])

    def test_with_prefix_lists_completions(self):
        self.assertEqual(list(self.words.with_prefix("CA")), ["cart", "cat"])
        self.assertEqual(list(self.words.with_prefix("dog")), [])

    def test_count_by_prefix(self):
        self.assertEqual(self.words.count("ca"), 2)
        self.assertEqual(self.words.count("cot"), 1)
        self.assertEqual(self.words.count("x"), 0)
        self.assertEqual(self.words.count(), 3)

    def test_remove_forgets_the_word(self):
        self.assertTrue(self.words.remove("cart"))
        self.assertNotIn("cart", self.words)
        self.assertFalse(self.words.remove("cart"))
        self.assertEqual(self.words.count("car"), 0)
        self.assertEqual(list(self.words), ["cat", "cot"])

    def test_re_adding_a_word_leaves_counts_alone(self):
        self.words.add("Cat")
        self.words.add("cat ")
        self.assertEqual(len(self.words), 3)
        self.assertEqual(self.words.count(), 3, "count() must agree with len()")
        self.assertEqual(self.words.count("ca"), 2, "only cat and cart start with 'ca'")

    def test_retiring_a_word_that_was_imported_twice(self):
        self.words.add("squash")
        self.words.add("Squash")
        self.assertTrue(self.words.remove("squash"))
        self.assertNotIn("squash", self.words)
        self.assertEqual(list(self.words.with_prefix("squ")), [])
        self.assertEqual(self.words.count("squ"), 0, "no stored word starts with 'squ' any more")


class LoaderTests(unittest.TestCase):
    def test_load_text_reports_duplicates_and_rejects(self):
        words = WordContainer()
        text = "# fruit\napple\nApple\n\n24/7\nbanana;40\n  pear  \n"
        report = load_text(words, text, "fruit.txt")
        self.assertEqual((report.added, report.duplicates), (3, 1))
        self.assertEqual([(line, entry) for line, entry, _ in report.rejected], [(5, "24/7")])
        self.assertEqual(list(words), ["apple", "banana", "pear"])

    def test_bundled_lists_import_summary(self):
        words = WordContainer()
        reports = load_bundled(words)
        self.assertEqual([(r.added, r.duplicates, len(r.rejected)) for r in reports],
                         [(339, 1, 2), (67, 10, 0), (41, 18, 0)])
        self.assertEqual(len(words), BUNDLED_TOTAL)

    def test_letter_breakdown_adds_up_to_the_total(self):
        words = bundled_store()
        breakdown = dict(letter_breakdown(words))
        self.assertEqual(sum(breakdown.values()), len(words), "the A-Z rows must add up to the headline total")
        self.assertEqual(breakdown, BUNDLED_FIRST_LETTERS)

    def test_prefix_badges_match_the_listed_completions(self):
        words = bundled_store()
        for prefix in ["bowl", "squ", "ba", "ca", "s"]:
            with self.subTest(prefix=prefix):
                self.assertEqual(words.count(prefix), len(list(words.with_prefix(prefix))))


if __name__ == "__main__":
    unittest.main()
