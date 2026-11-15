import unittest

from oneofeach import (Puzzle, WordListError, filter_words, is_valid_selection, parse_word_list,
                       playable_words, selection_problems)
from oneofeach.board import render

SAMPLE_LIST = """
# word     difficulty  themes
Tango      2           music, dance
otter      1           animals
fig        1           kitchen, garden
jam        1           kitchen, music
quiche     3           kitchen
"""


class ValidatorTests(unittest.TestCase):
    def test_clean_board_has_no_problems(self):
        self.assertEqual(selection_problems(["zebra", "lynx", "dog"]), [])
        self.assertTrue(is_valid_selection(["zebra", "lynx", "dog"]))

    def test_words_sharing_a_letter_are_rejected(self):
        problems = selection_problems(["drum", "harp"])
        self.assertEqual(len(problems), 1)
        self.assertIn("'r'", problems[0])

    def test_clash_report_names_every_earlier_word(self):
        problems = selection_problems(["drum", "harp", "tempo"])
        self.assertEqual(len(problems), 2)
        self.assertIn("'drum'", problems[1])
        self.assertIn("'harp'", problems[1])

    def test_reported_kitchen_board_is_rejected(self):
        # Player report for 2026-10-12: "today's board has two Ts".
        self.assertFalse(is_valid_selection(["butter", "fig", "jam", "wok"]))

    def test_double_letter_problem_names_the_letter(self):
        problems = selection_problems(["moss", "fern"])
        self.assertEqual(len(problems), 1)
        self.assertIn("'moss'", problems[0])
        self.assertIn("'s'", problems[0])

    def test_letter_used_three_times_in_one_word(self):
        self.assertFalse(is_valid_selection(["bobbin"]))


class PuzzleTests(unittest.TestCase):
    def test_tile_count_counts_every_tile(self):
        puzzle = Puzzle("2026-10-12", "kitchen", ["butter", "fig", "jam", "wok"])
        self.assertEqual(puzzle.tile_count, 15)
        self.assertIn("15 tiles", render(puzzle))

    def test_unused_letters(self):
        puzzle = Puzzle("2026-10-14", "animals", ["zebra", "lynx", "dog"])
        self.assertEqual(puzzle.tile_count, 12)
        self.assertEqual(puzzle.unused_letters, "cfhijkmpqstuvw")


class WordListTests(unittest.TestCase):
    def test_parse_reads_difficulty_and_themes(self):
        words = parse_word_list(SAMPLE_LIST)
        self.assertEqual([w.text for w in words], ["tango", "otter", "fig", "jam", "quiche"])
        self.assertEqual(words[0].difficulty, 2)
        self.assertEqual(words[0].tags, {"music", "dance"})

    def test_filter_by_theme_and_difficulty(self):
        words = parse_word_list(SAMPLE_LIST)
        self.assertEqual([w.text for w in filter_words(words, theme="kitchen")], ["fig", "jam", "quiche"])
        self.assertEqual([w.text for w in filter_words(words, theme="kitchen", max_difficulty=2)], ["fig", "jam"])

    def test_bad_word_reports_its_line(self):
        with self.assertRaises(WordListError) as caught:
            parse_word_list("fig 1 kitchen\nrock'n'roll 2 music\n")
        self.assertIn("line 2", str(caught.exception))

    def test_playable_words_skip_double_letters_and_duplicates(self):
        words = parse_word_list(SAMPLE_LIST + "fig 2 snacks\n")
        self.assertEqual([w.text for w in playable_words(words)], ["tango", "fig", "jam", "quiche"])


if __name__ == "__main__":
    unittest.main()
