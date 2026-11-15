import unittest

from spellcheck import Dictionary, Misspelling, SpellChecker, tokenize
from spellcheck.report import format_report, line_col, underline

WORDS = Dictionary.load()


def spans(tokens):
    return [(t.text, t.start, t.end) for t in tokens]


def issues(text):
    return [(m.word, m.start, m.end) for m in SpellChecker(WORDS).check(text)]


class TokenizerTests(unittest.TestCase):
    def test_words_and_offsets(self):
        self.assertEqual(spans(tokenize("Hello, world!")), [("Hello", 0, 5), ("world", 7, 12)])

    def test_hyphenated_words_are_split(self):
        self.assertEqual(spans(tokenize("A well-known, half-baked idea")),
                         [("A", 0, 1), ("well", 2, 6), ("known", 7, 12),
                          ("half", 14, 18), ("baked", 19, 24), ("idea", 25, 29)])

    def test_numbers_are_skipped(self):
        self.assertEqual(spans(tokenize("Room 204 at 10am on the 3rd")),
                         [("Room", 0, 4), ("at", 9, 11), ("on", 17, 19), ("the", 20, 23)])

    def test_apostrophes_inside_words(self):
        self.assertEqual(spans(tokenize("I don't think it's 5 o'clock")),
                         [("I", 0, 1), ("don't", 2, 7), ("think", 8, 13),
                          ("it's", 14, 18), ("o'clock", 21, 28)])

    def test_quotes_around_words_are_not_part_of_them(self):
        self.assertEqual(spans(tokenize("'Draft' notes, the students' work")),
                         [("Draft", 1, 6), ("notes", 8, 13), ("the", 15, 18),
                          ("students", 19, 27), ("work", 29, 33)])

    def test_smart_quotes_around_words(self):
        self.assertEqual(spans(tokenize("She wrote ‘mispelled’ twice")),
                         [("She", 0, 3), ("wrote", 4, 9), ("mispelled", 11, 20), ("twice", 22, 27)])

    def test_contractions_typed_on_mobile_stay_whole(self):
        self.assertEqual(spans(tokenize("We don’t ship until it’s ready")),
                         [("We", 0, 2), ("don’t", 3, 8), ("ship", 9, 13),
                          ("until", 14, 19), ("it’s", 20, 24), ("ready", 25, 30)])


class CheckerTests(unittest.TestCase):
    def test_misspellings_are_reported_with_offsets(self):
        self.assertEqual(issues("I recieve too many emials."), [("recieve", 2, 9), ("emials", 19, 25)])

    def test_case_does_not_matter(self):
        self.assertEqual(issues("Tomorrow the team mets. Monday works."), [("mets", 18, 22)])
        checker = SpellChecker(WORDS, ignore_uppercase=False)
        self.assertEqual(checker.check("TOMORROW Works"), [])

    def test_acronyms_are_skipped(self):
        self.assertEqual(issues("Ask NASA about the API"), [])
        checker = SpellChecker(WORDS, ignore_uppercase=False)
        self.assertEqual([m.word for m in checker.check("Ask NASA about the API")], ["NASA", "API"])

    def test_contractions_and_possessives(self):
        self.assertEqual(issues("I don't know if the team's draft is done, but it's close."), [])

    def test_ignore_all_accepts_a_word(self):
        checker = SpellChecker(WORDS)
        self.assertEqual(checker.check("Deploy Kubernetes today"),
                         [Misspelling("Deploy", 0, 6), Misspelling("Kubernetes", 7, 17)])
        checker.ignore("kubernetes")
        checker.ignore("DEPLOY")
        self.assertEqual(checker.check("Deploy Kubernetes today"), [])

    def test_contractions_typed_on_mobile(self):
        self.assertEqual(issues("I don’t know if it’s done, and we can’t wait."), [])

    def test_possessives_typed_on_mobile(self):
        self.assertEqual(issues("The team’s notes are in the project’s folder."), [])

    def test_misspellings_next_to_mobile_contractions(self):
        self.assertEqual(issues("Ths isn’t rihgt, they’re late"), [("Ths", 0, 3), ("rihgt", 10, 15)])


class ReportTests(unittest.TestCase):
    TEXT = "Standup notes\nShipped the calender view.\nTeh end"
    FOUND = [Misspelling("calender", 26, 34), Misspelling("Teh", 41, 44)]

    def test_line_and_column(self):
        self.assertEqual(line_col(self.TEXT, 0), (1, 1))
        self.assertEqual(line_col(self.TEXT, 26), (2, 13))
        self.assertEqual(line_col(self.TEXT, 41), (3, 1))

    def test_underline_marks_each_word(self):
        self.assertEqual(underline(self.TEXT, self.FOUND),
                         "Standup notes\n"
                         "Shipped the calender view.\n"
                         "            ^^^^^^^^\n"
                         "Teh end\n"
                         "^^^")

    def test_report_rows(self):
        self.assertEqual(format_report(self.TEXT, self.FOUND),
                         "2 spelling issues:\n  2:13    calender\n  3:1     Teh")
        self.assertEqual(format_report(self.TEXT, []), "No spelling issues found.")

    def test_report_with_suggestions(self):
        options = {"calender": ["calendar"], "Teh": []}
        self.assertEqual(format_report(self.TEXT, self.FOUND, options.get),
                         "2 spelling issues:\n"
                         "  2:13    calender      -> calendar\n"
                         "  3:1     Teh           (no suggestions)")


if __name__ == "__main__":
    unittest.main()
