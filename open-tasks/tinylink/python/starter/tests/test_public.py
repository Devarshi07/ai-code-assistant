"""Provided tests: the basic happy path. The hidden acceptance tests go further."""
import unittest

from tinylink import LinkNotFoundError, TinyLink

T0 = 1_700_000_000_000  # some moment in November 2023, in ms


class CoreTests(unittest.TestCase):
    def test_first_generated_codes_count_up_from_000001(self):
        links = TinyLink()
        self.assertEqual(links.create("https://example.com/a", "alice", T0), "000001")
        self.assertEqual(links.create("https://example.com/b", "alice", T0), "000002")
        self.assertEqual(links.create("https://example.com/c", "bob", T0), "000003")

    def test_generated_codes_use_digits_then_upper_then_lower_case(self):
        links = TinyLink()
        codes = [links.create(f"https://example.com/{i}", "alice", T0) for i in range(36)]
        self.assertEqual(codes[9], "00000A")   # counter 10
        self.assertEqual(codes[35], "00000a")  # counter 36

    def test_resolve_returns_the_original_url(self):
        links = TinyLink()
        code = links.create("https://shop.example.com/spring?utm_source=flyer", "alice", T0)
        self.assertEqual(links.resolve(code, T0 + 1, "visitor-1"),
                         "https://shop.example.com/spring?utm_source=flyer")

    def test_custom_alias_is_returned_as_given_and_resolves_in_any_case(self):
        links = TinyLink()
        code = links.create("https://example.com/sale", "alice", T0, alias="Spring-Sale")
        self.assertEqual(code, "Spring-Sale")
        self.assertEqual(links.resolve("Spring-Sale", T0, "v1"), "https://example.com/sale")
        self.assertEqual(links.resolve("spring-sale", T0, "v2"), "https://example.com/sale")

    def test_unknown_code_raises_link_not_found(self):
        links = TinyLink()
        links.create("https://example.com", "alice", T0)
        with self.assertRaises(LinkNotFoundError):
            links.resolve("zzzzzz", T0, "v1")


class StatsTests(unittest.TestCase):
    def test_stats_count_clicks_and_unique_visitors(self):
        links = TinyLink()
        code = links.create("https://example.com", "alice", T0)
        for visitor in ["ana", "ben", "ana"]:
            links.resolve(code, T0 + 1000, visitor)
        stats = links.stats(code)
        self.assertEqual(stats.total_clicks, 3)
        self.assertEqual(stats.unique_visitors, 2)


if __name__ == "__main__":
    unittest.main()
