import unittest

from spellcheck import Dictionary, SpellChecker
from spellcheck.suggest import Suggester, edit_distance

WORDS = Dictionary.load()

# Every word here except "damper" is one or two edits away from "lamp".
RANKING = Dictionary.parse("""
lamp 40
lamb 40
limp 90
lump 10
lam 5
clamp 40
camp 300
ramp 40
lisp 70
clasp 500
lumps 999
damper 1000
""")


class EditDistanceTests(unittest.TestCase):
    def test_identical_and_empty(self):
        self.assertEqual(edit_distance("note", "note"), 0)
        self.assertEqual(edit_distance("", ""), 0)
        self.assertEqual(edit_distance("", "abc"), 3)
        self.assertEqual(edit_distance("abc", ""), 3)

    def test_single_edits(self):
        self.assertEqual(edit_distance("note", "notes"), 1, "insertion")
        self.assertEqual(edit_distance("notes", "note"), 1, "deletion")
        self.assertEqual(edit_distance("note", "nose"), 1, "substitution")
        self.assertEqual(edit_distance("calender", "calendar"), 1)
        self.assertEqual(edit_distance("tomorow", "tomorrow"), 1)

    def test_swapped_letters_cost_two(self):
        self.assertEqual(edit_distance("teh", "the"), 2)
        self.assertEqual(edit_distance("recieve", "receive"), 2)
        self.assertEqual(edit_distance("ab", "ba"), 2)

    def test_longer_distances(self):
        self.assertEqual(edit_distance("flaw", "lawn"), 2)
        self.assertEqual(edit_distance("receipt", "recipe"), 2)
        self.assertEqual(edit_distance("spelling", "misspelled"), 6)
        self.assertEqual(edit_distance("notebook", "bookmark"), 6)

    def test_apostrophes_and_accents_are_characters(self):
        self.assertEqual(edit_distance("dont", "don't"), 1)
        self.assertEqual(edit_distance("cafe", "café"), 1)


class RankingTests(unittest.TestCase):
    def test_closest_first_then_most_frequent_then_alphabetical(self):
        self.assertEqual(Suggester(RANKING).suggest("lamp", 20),
                         ["lamp", "camp", "limp", "clamp", "lamb", "ramp", "lump", "lam",
                          "lumps", "clasp", "lisp"])

    def test_misspelled_word(self):
        self.assertEqual(Suggester(RANKING).suggest("lmp", 20),
                         ["limp", "lamp", "lump", "lumps", "camp", "lisp", "clamp", "lamb",
                          "ramp", "lam"])

    def test_limit(self):
        suggester = Suggester(RANKING)
        self.assertEqual(suggester.suggest("lmp", 4), ["limp", "lamp", "lump", "lumps"])
        self.assertEqual(suggester.suggest("lmp"), ["limp", "lamp", "lump", "lumps", "camp"],
                         "the default limit is 5")

    def test_input_is_normalized(self):
        self.assertEqual(Suggester(RANKING).suggest("LAMP", 3), ["lamp", "camp", "limp"])

    def test_nothing_close_enough(self):
        self.assertEqual(Suggester(RANKING).suggest("xyzzy"), [])
        self.assertEqual(Suggester(WORDS).suggest("xylophone"), [])


class SuggestionTests(unittest.TestCase):
    def setUp(self):
        self.suggester = Suggester(WORDS)

    def test_distance_beats_frequency(self):
        self.assertEqual(self.suggester.suggest("recieve"), ["relieve", "receive", "believe"])

    def test_common_typos(self):
        self.assertEqual(self.suggester.suggest("tomorow"), ["tomorrow"])
        self.assertEqual(self.suggester.suggest("havent"), ["haven't", "have"])
        self.assertEqual(self.suggester.suggest("freind"), ["friend", "fiend", "find", "fried"])
        self.assertEqual(self.suggester.suggest("occured"), ["occurred", "occur"])

    def test_short_words(self):
        self.assertEqual(self.suggester.suggest("teh"), ["tea", "tech", "ten", "the", "be"])
        self.assertEqual(self.suggester.suggest("carr", 4), ["car", "card", "care", "cart"])

    def test_frequency_ties_are_alphabetical(self):
        self.assertEqual(self.suggester.suggest("wierd"), ["were", "word", "weird", "wired", "fiend"])

    def test_apostrophes_and_accents(self):
        self.assertEqual(self.suggester.suggest("dont", 3), ["don't", "done", "dot"])
        self.assertEqual(self.suggester.suggest("cafe", 3), ["came", "café", "care"])
        self.assertEqual(self.suggester.suggest("don’t", 4), ["don't", "won't", "can't", "doesn't"])


class CheckerSuggestionTests(unittest.TestCase):
    def test_suggestions_follow_the_writers_capitalisation(self):
        checker = SpellChecker(WORDS)
        self.assertEqual(checker.suggest("Recieve"), ["Relieve", "Receive", "Believe"])
        self.assertEqual(checker.suggest("TEH", 3), ["TEA", "TECH", "TEN"])
        self.assertEqual(checker.suggest("Thier", 6), ["The", "This", "They", "Her", "There", "Their"])

    def test_misspellings_with_suggestions(self):
        checker = SpellChecker(WORDS)
        text = "Teh calender is ready"
        found = checker.check(text)
        self.assertEqual([m.word for m in found], ["Teh", "calender"])
        self.assertEqual([checker.suggest(m.word, 2) for m in found], [["Tea", "Tech"], ["calendar"]])


if __name__ == "__main__":
    unittest.main()
