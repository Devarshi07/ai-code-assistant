import time
import unittest

from spellcheck.suggest import Suggester
from tests.corpus import large_dictionary, typo_batch

SIZE = 20_000      # entries in the full dictionary
BATCH = 100        # right-click lookups in the timed test
LIMIT = 3.0        # seconds allowed for the whole batch

_shared = {}


def shared():
    """The large dictionary and one Suggester over it, built once per run."""
    if not _shared:
        dictionary = large_dictionary(SIZE)
        suggester = Suggester(dictionary)
        suggester.suggest("warm")   # let lazy indexes finish building
        _shared.update(dictionary=dictionary, suggester=suggester)
    return _shared["dictionary"], _shared["suggester"]


class LargeDictionaryTests(unittest.TestCase):
    def setUp(self):
        self.dictionary, self.suggester = shared()

    def test_dictionary_size(self):
        self.assertEqual(len(self.dictionary), SIZE)

    def test_typos_of_real_words(self):
        suggest = self.suggester.suggest
        self.assertEqual(suggest("recieve"), ["relieve", "receive", "believe"])
        self.assertEqual(suggest("teh", 8), ["tea", "tel", "te", "ted", "tee", "tech", "ten", "the"])
        self.assertEqual(suggest("unfortunatelly"), ["unfortunately"])

    def test_apostrophes_and_accents(self):
        suggest = self.suggester.suggest
        self.assertEqual(suggest("dont", 7), ["don't", "done", "don", "dout", "dond", "dong", "dot"])
        self.assertEqual(suggest("cafe", 6), ["came", "pafe", "ceafe", "cale", "eafe", "café"])

    def test_very_short_words(self):
        suggest = self.suggester.suggest
        self.assertEqual(suggest("e", 12), ["e", "be", "a", "i", "he", "we", "me", "pe", "em", "je", "fe", "ne"])
        self.assertEqual(suggest("ab", 12), ["a", "as", "at", "an", "ad", "ar", "am", "al", "ai", "be", "to", "of"])

    def test_generated_words(self):
        suggest = self.suggester.suggest
        self.assertEqual(suggest("siling", 12),
                         ["siling", "kiling", "miling", "riling", "tiling", "iling", "liling", "niling",
                          "saling", "griling", "soing", "sudiling"])
        self.assertEqual(suggest("leck", 12),
                         ["leck", "neck", "weck", "lecks", "deck", "peck", "beck", "leeck", "cleck",
                          "jeck", "seck", "fleck"])
        self.assertEqual(suggest("thnd", 12),
                         ["tond", "thad", "thand", "tand", "tynd", "thond", "thind", "thed", "tind",
                          "the", "and", "that"])
        self.assertEqual(suggest("tad", 12),
                         ["tad", "had", "bad", "lad", "thad", "zad", "ad", "tas", "tand", "dad", "tat", "tal"])

    def test_long_and_unmatched_words(self):
        self.assertEqual(self.suggester.suggest("plumtobued"), ["plumtobued"])
        self.assertEqual(self.suggester.suggest("xqzvbnm"), [])

    def test_batch_of_lookups_is_fast(self):
        batch = typo_batch(self.dictionary, BATCH)
        results = []
        start = time.perf_counter()
        for word in batch:
            results.append(self.suggester.suggest(word))
            if time.perf_counter() - start > 3 * LIMIT:
                break   # far too slow already; stop instead of running for minutes
        elapsed = time.perf_counter() - start
        self.assertEqual(len(results), BATCH,
                         f"only {len(results)} of {BATCH} lookups finished in {elapsed:.1f}s; "
                         f"all {BATCH} must finish in under {LIMIT}s")
        self.assertEqual(results[0], ["view", "voai", "vis", "vist", "viga"])
        self.assertEqual(results[2], ["zond", "foud", "zou", "loud", "noud"])
        self.assertEqual(results[49], [])
        self.assertEqual(results[99], ["dengshemdran"])
        self.assertEqual(sum(len(r) for r in results), 275, "total suggestions across the batch")
        self.assertLess(elapsed, LIMIT, f"{BATCH} lookups took {elapsed:.2f}s; they must finish in under {LIMIT}s")


if __name__ == "__main__":
    unittest.main()
