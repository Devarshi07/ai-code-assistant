import time
import unittest

from oneofeach import best_selection
from tests.theme_packs import long_word_pack, short_word_pack


def assert_valid_selection(test, candidates, result):
    """Independent check: a real board built from the candidates, honestly scored."""
    pool = {c.strip().lower() for c in candidates}
    words = list(result.words)
    test.assertEqual(words, sorted(words), "words must be in alphabetical order")
    seen = set()
    for word in words:
        test.assertIn(word, pool, f"{word!r} is not one of the candidates")
        test.assertEqual(len(set(word)), len(word), f"{word!r} repeats a letter")
        test.assertFalse(seen & set(word), f"{word!r} reuses a letter already on the board")
        seen |= set(word)
    test.assertEqual(result.total, sum(len(word) for word in words), "total must count every tile")


class ScaleTests(unittest.TestCase):
    def check(self, candidates, words, total):
        result = best_selection(candidates)
        assert_valid_selection(self, candidates, result)
        self.assertEqual(result.total, total)
        self.assertEqual(list(result.words), words)

    def test_anagram_spellings_keep_the_alphabetical_tie_break(self):
        candidates = ["stop", "pots", "tops", "opts", "spot", "post", "Chew", "chew", "cheww", "pod", "tan", "and", "top"]
        self.check(candidates, ["and", "chew", "opts"], 11)

    def test_small_short_word_pack(self):
        # 16 boards tie on 20 letters.
        self.check(short_word_pack(5, 70), ["dqat", "ek", "fpsn", "hy", "ir", "jm", "zwlo"], 20)

    def test_medium_short_word_pack(self):
        # 52 boards over five different letter sets tie on 21 letters.
        self.check(short_word_pack(21, 120), ["cq", "eb", "gn", "iay", "mh", "oz", "srx", "tdw", "vu"], 21)

    def test_small_long_word_pack(self):
        # 512 spellings of the same board tie on 20 letters.
        self.check(long_word_pack(6, 150), ["azlhmby", "cgoq", "iwju", "svdrt"], 20)

    def test_medium_long_word_pack(self):
        self.check(long_word_pack(8, 250), ["abktj", "cxuonyz", "dwep", "hvqlmr"], 22)

    def timed(self, candidates, words, total, limit):
        start = time.perf_counter()
        result = best_selection(candidates)
        elapsed = time.perf_counter() - start
        assert_valid_selection(self, candidates, result)
        self.assertEqual(result.total, total)
        self.assertEqual(list(result.words), words)
        self.assertLess(elapsed, limit, f"took {elapsed:.2f}s; a {len(candidates)}-word pack must solve in under {limit}s")

    def test_large_short_word_pack_is_fast(self):
        self.timed(short_word_pack(13, 160), ["al", "czsv", "dfho", "eb", "jn", "mxu", "twqi", "yrp"], 24, 0.3)

    def test_large_long_word_pack_is_fast(self):
        self.timed(long_word_pack(12, 500), ["brsft", "dugnl", "eohjapi", "wykczqm"], 24, 0.3)


if __name__ == "__main__":
    unittest.main()
