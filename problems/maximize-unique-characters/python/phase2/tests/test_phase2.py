import unittest

from oneofeach import Word, best_selection, filter_words, load_word_list, parse_word_list


def assert_valid_selection(test, candidates, result):
    """Independent check: a real board built from the candidates, honestly scored."""
    pool = {(c.text if isinstance(c, Word) else c.strip().lower()) for c in candidates}
    words = list(result.words)
    test.assertEqual(words, sorted(words), "words must be in alphabetical order")
    seen = set()
    for word in words:
        test.assertIn(word, pool, f"{word!r} is not one of the candidates")
        test.assertEqual(len(set(word)), len(word), f"{word!r} repeats a letter")
        test.assertFalse(seen & set(word), f"{word!r} reuses a letter already on the board")
        seen |= set(word)
    test.assertEqual(result.total, sum(len(word) for word in words), "total must count every tile")


class BestSelectionTests(unittest.TestCase):
    def check(self, candidates, words, total, message=None):
        result = best_selection(candidates)
        assert_valid_selection(self, candidates, result)
        self.assertEqual(result.total, total, message)
        self.assertEqual(list(result.words), words, message)

    def test_three_animals_fit_together(self):
        self.check(["cat", "dog", "bird", "fish"], ["cat", "dog", "fish"], 10)

    def test_words_with_repeated_letters_are_never_used(self):
        self.check(["letter", "otter", "cab", "dim"], ["cab", "dim"], 6)

    def test_longest_word_first_is_not_optimal(self):
        self.check(["blanket", "trophy", "jumbled", "fix"], ["fix", "jumbled", "trophy"], 16,
                   "two medium words beat the longest word")

    def test_tie_goes_to_the_alphabetically_first_word_list(self):
        # 'pod tan' and 'and top' both cover the same six letters.
        self.check(["tan", "pod", "top", "and"], ["and", "top"], 6)

    def test_anagram_tie_picks_the_first_spelling(self):
        self.check(["pot", "top", "opt", "and"], ["and", "opt"], 6)

    def test_words_are_normalized_and_deduplicated(self):
        self.check(["Tango", "tango", " FLY ", "jinx"], ["fly", "tango"], 8)

    def test_nothing_playable_gives_an_empty_board(self):
        self.check([], [], 0)
        self.check(["otter", "llama", "kiwi"], [], 0)

    def test_sixteen_candidates_with_five_tied_boards(self):
        candidates = ["quiz", "jumpy", "vex", "fjord", "glyph", "brick", "wealth", "stomp", "dwarf", "nymph",
                      "sculpt", "garden", "volcano", "kiosk", "whisky", "zebra"]
        self.check(candidates, ["dwarf", "glyph", "quiz", "vex"], 17)

    def test_accepts_words_from_the_loader(self):
        words = parse_word_list("Banjo 2 music\nharp 1 music\nsax 2 music\nflute 1 music\n")
        self.check(words, ["banjo", "flute"], 10)

    def test_music_theme_from_the_word_list(self):
        candidates = filter_words(load_word_list(), theme="music", max_difficulty=2)
        self.check(candidates, ["chord", "flute", "jam"], 13)

    def test_kitchen_theme_from_the_word_list(self):
        candidates = filter_words(load_word_list(), theme="kitchen", max_difficulty=2)
        self.check(candidates, ["bread", "fig", "plum", "wok"], 15)


if __name__ == "__main__":
    unittest.main()
