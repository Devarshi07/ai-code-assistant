import re
import time
import unittest

from wordstore import WordContainer
from tests.generator import generate_words, search_patterns, slot_patterns

# The whole grid-fill batch (200 queries on a 130k-word dictionary) must finish in this time.
BATCH_SECONDS = 2.0

# Awkward shapes: leading stars, several stars, stars between blanks.
TRICKY = ["*ing", "*a*a*", "?*?*?", "*oo*", "b*b", "*x", "???*???", "*e?e*", "s*s*s", "?"]


_built = {}


def dictionary(seed, count):
    """A WordContainer of generated words, built once per test run and shared by the tests."""
    if (seed, count) not in _built:
        words = WordContainer(generate_words(seed, count))
        _built[seed, count] = (words, list(words))
    return _built[seed, count]


def brute_force(words, pattern, limit=None):
    """Independent check: the pattern as a regular expression, tried on every word."""
    regex = re.compile(pattern.replace("?", "[a-z]").replace("*", "[a-z]*"))
    found = [word for word in words if regex.fullmatch(word)]
    return found if limit is None else found[:limit]


class MediumDictionaryTests(unittest.TestCase):
    def setUp(self):
        self.words, self.listed = dictionary(11, 20000)

    def test_dictionary_size(self):
        self.assertEqual(len(self.words), 19084)

    def test_known_answers(self):
        self.assertEqual(self.words.match("br??k*"), [
            "brack", "brarkeetroun", "brecksilbrats", "breekour", "briekoal",
            "briekoulls", "briekout", "brookoonts", "broxkais", "brudkaiing"])
        self.assertEqual(self.words.match("s?a?e"), ["seaze", "slabe"])
        self.assertEqual(self.words.match("*ooo*"), ["boooodthoob", "liebroooop", "nooostciex", "yoooy"])
        self.assertEqual(self.words.match("?*z"), [])
        self.assertEqual(self.words.match("q*"), [])

    def test_broad_patterns(self):
        cases = {
            "?oo?": (72, ["boog", "bool", "boom"], ["zoop", "zoos", "zoot"]),
            "*ing": (1153, ["ailling", "airing", "aisleating"], ["zydnaing", "zyllthiexing", "zyting"]),
            "??????": (1833, ["aibtai", "aichee", "ailler"], ["zynpie", "zyting", "zytwos"]),
            "*a*e*i*": (218, ["aisleating", "aitmeaing", "aitveeting"], ["zasitweasing", "zauntslenwai", "zeaketmid"]),
            "??????????????????*": (13, ["braindstougjending", "braingshaunclecking", "deantchoondclinter"],
                                    ["speentploolconging", "stierfloackbriered", "stoungspeantpleast"]),
        }
        for pattern, (total, first, last) in cases.items():
            with self.subTest(pattern=pattern):
                found = self.words.match(pattern)
                self.assertEqual((len(found), found[:3], found[-3:]), (total, first, last))
        self.assertEqual(self.words.match("*"), self.listed)

    def test_limits(self):
        self.assertEqual(self.words.match("s*", 5), ["sa", "sab", "sabbat", "sabot", "sabraclour"])
        self.assertEqual(self.words.match("*ing", 4), ["ailling", "airing", "aisleating", "aitmeaing"])
        self.assertEqual(self.words.match("?e?e*", 6),
                         ["bedeadbrall", "beeed", "beeeed", "behextecker", "bekeed", "bereater"])

    def test_generated_queries_agree_with_brute_force(self):
        patterns = slot_patterns(self.listed, 5, 30) + search_patterns(self.listed, 6, 20) + TRICKY
        for pattern in patterns:
            with self.subTest(pattern=pattern):
                self.assertEqual(self.words.match(pattern), brute_force(self.listed, pattern))
        for pattern in TRICKY:
            with self.subTest(pattern=pattern, limit=7):
                self.assertEqual(self.words.match(pattern, 7), brute_force(self.listed, pattern, 7))


class MutationTests(unittest.TestCase):
    def test_results_track_additions_and_removals(self):
        words = WordContainer(generate_words(3, 6000))
        listed = list(words)
        queries = slot_patterns(listed, 8, 15) + search_patterns(listed, 9, 10) + TRICKY + ["*", "????????????*"]
        for pattern in queries:
            words.match(pattern)  # warm up anything an implementation caches
        retired = [word for i, word in enumerate(listed) if i % 3 == 0 or len(word) > 11]
        for word in retired:
            self.assertTrue(words.remove(word))
        newcomers = generate_words(4, 3000)
        words.add_all(newcomers)
        current = sorted(set(listed).difference(retired).union(newcomers))
        self.assertEqual(list(words), current)
        for pattern in queries:
            with self.subTest(pattern=pattern):
                self.assertEqual(words.match(pattern), brute_force(current, pattern))
        self.assertEqual(words.match("*ing", 5), brute_force(current, "*ing", 5))


class ScaleTests(unittest.TestCase):
    def setUp(self):
        self.words, listed = dictionary(2024, 150000)
        # A grid-fill pass: slots with crossing letters known, plus solver-panel searches.
        self.batch = ([(pattern, None) for pattern in slot_patterns(listed, 77, 150)]
                      + [(pattern, 20) for pattern in search_patterns(listed, 78, 50)])

    def test_large_dictionary_spot_checks(self):
        self.assertEqual(len(self.words), 130128)
        self.assertEqual(self.words.match("th??n"), ["thaun", "thean", "theen", "thien", "thoan", "thoon"])
        found = self.words.match("b?ea?")
        self.assertEqual((len(found), found[:4], found[-2:]),
                         (13, ["beeai", "biead", "bieai", "bieas"], ["breat", "breay"]))
        self.assertEqual(self.words.match("dr?n*", 4), ["dran", "dranaas", "dranboobougy", "drancested"])

    def test_grid_fill_batch_is_fast(self):
        found = letters = 0
        start = time.perf_counter()
        for done, (pattern, limit) in enumerate(self.batch, start=1):
            result = self.words.match(pattern, limit)
            found += len(result)
            letters += sum(len(word) for word in result)
            elapsed = time.perf_counter() - start
            if elapsed > BATCH_SECONDS:
                self.fail(f"only {done} of {len(self.batch)} queries finished in {elapsed:.2f}s; "
                          f"the whole batch must finish in under {BATCH_SECONDS}s")
        self.assertEqual((found, letters), (2334, 16082), "batch returned the wrong words")


if __name__ == "__main__":
    unittest.main()
