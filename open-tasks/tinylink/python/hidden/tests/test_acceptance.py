"""Hidden acceptance tests for TinyLink. They use only the documented interface."""
import unittest

from tinylink import (
    AliasTakenError,
    InvalidAliasError,
    InvalidExpiryError,
    InvalidUrlError,
    LinkDeletedError,
    LinkExpiredError,
    LinkNotFoundError,
    QuotaExceededError,
    RestoreConflictError,
    TinyLink,
    TinyLinkError,
    ValidationError,
)

T0 = 1_700_000_000_000
DAY = 86_400_000
URL = "https://example.com/landing"


def url(i):
    return f"https://example.com/{i}"


def generate(links, count, owner="alice", now=T0):
    return [links.create(url(i), owner, now) for i in range(count)]


class CodeGenerationTests(unittest.TestCase):
    def test_codes_follow_base62_order_across_digit_boundaries(self):
        codes = generate(TinyLink(), 63)
        self.assertEqual(codes[0], "000001")
        self.assertEqual(codes[8], "000009")
        self.assertEqual(codes[9], "00000A")
        self.assertEqual(codes[34], "00000Z")
        self.assertEqual(codes[35], "00000a")
        self.assertEqual(codes[60], "00000z")
        self.assertEqual(codes[61], "000010")
        self.assertEqual(codes[62], "000011")
        self.assertEqual(len(set(codes)), 63)

    def test_counter_rolls_over_to_a_third_digit(self):
        codes = generate(TinyLink(), 3844)
        self.assertEqual(codes[3842], "0000zz")
        self.assertEqual(codes[3843], "000100")

    def test_generator_skips_and_consumes_codes_taken_by_aliases(self):
        links = TinyLink()
        self.assertEqual(links.create(URL, "bob", T0, alias="000002"), "000002")
        self.assertEqual(generate(links, 3), ["000001", "000003", "000004"])

    def test_generator_skip_ignores_case_against_aliases(self):
        links = TinyLink()
        links.create(URL, "bob", T0, alias="00000a")
        codes = generate(links, 11)
        self.assertEqual(codes[8], "000009")
        self.assertEqual(codes[9], "00000B")
        self.assertEqual(codes[10], "00000C")

    def test_generator_never_reissues_the_code_of_a_deleted_alias(self):
        links = TinyLink()
        links.create(URL, "alice", T0, alias="000001")
        links.delete("000001")
        self.assertEqual(links.create(URL, "alice", T0), "000002")


class UrlValidationTests(unittest.TestCase):
    def test_accepts_valid_urls_and_returns_them_unchanged(self):
        longest = "https://example.com/" + "a" * 2028
        self.assertEqual(len(longest), 2048)
        valid = [
            "http://a",
            "HTTPS://Example.COM/Path?q=1#frag",
            "Http://example.com:8080",
            "https://x?y=1",
            "https://x#top",
            longest,
        ]
        links = TinyLink()
        for target in valid:
            with self.subTest(url=target[:60]):
                code = links.create(target, "alice", T0)
                self.assertEqual(links.resolve(code, T0, "v1"), target)

    def test_rejects_urls_without_an_http_scheme_or_host(self):
        invalid = [
            "",
            "example.com",
            "ftp://example.com",
            "//example.com",
            "javascript:alert(1)",
            "mailto:team@example.com",
            "http:/example.com",
            "httpx://example.com",
            "http://",
            "https://",
            "https:///path",
            "https://?q=1",
            "http://#top",
        ]
        links = TinyLink()
        for target in invalid:
            with self.subTest(url=target):
                with self.assertRaises(InvalidUrlError):
                    links.create(target, "alice", T0)

    def test_rejects_whitespace_and_urls_over_2048_characters(self):
        too_long = "https://example.com/" + "a" * 2029
        self.assertEqual(len(too_long), 2049)
        invalid = [
            "http://exa mple.com",
            "https://example.com/a b",
            "https://example.com/\t",
            "https://example.com\n",
            "https://example.com/x\r",
            too_long,
        ]
        links = TinyLink()
        for target in invalid:
            with self.subTest(url=repr(target[:40])):
                with self.assertRaises(InvalidUrlError) as caught:
                    links.create(target, "alice", T0)
                self.assertIsInstance(caught.exception, ValidationError)
                self.assertIsInstance(caught.exception, TinyLinkError)


class AliasTests(unittest.TestCase):
    def test_alias_length_is_3_to_30_inclusive(self):
        links = TinyLink()
        self.assertEqual(links.create(URL, "alice", T0, alias="abc"), "abc")
        self.assertEqual(links.create(URL, "alice", T0, alias="x" * 30), "x" * 30)
        for alias in ["", "ab", "y" * 31]:
            with self.subTest(alias=alias):
                with self.assertRaises(InvalidAliasError) as caught:
                    links.create(URL, "alice", T0, alias=alias)
                self.assertIsInstance(caught.exception, ValidationError)

    def test_alias_characters_are_ascii_letters_digits_and_hyphen(self):
        links = TinyLink()
        for alias in ["a-b", "---", "Q3-2024-Launch", "123"]:
            with self.subTest(alias=alias):
                self.assertEqual(links.create(URL, "alice", T0, alias=alias), alias)
        for alias in ["spring_sale", "spring.sale", "spring sale", "café-x", "sale/2024", "sale!", "promo\n"]:
            with self.subTest(alias=repr(alias)):
                with self.assertRaises(InvalidAliasError):
                    links.create(URL, "alice", T0, alias=alias)

    def test_aliases_are_unique_ignoring_case_across_owners(self):
        links = TinyLink()
        links.create(url(1), "alice", T0, alias="Promo")
        for owner, alias in [("bob", "PROMO"), ("alice", "promo"), ("carol", "Promo")]:
            with self.subTest(alias=alias):
                with self.assertRaises(AliasTakenError) as caught:
                    links.create(url(2), owner, T0, alias=alias)
                self.assertIsInstance(caught.exception, TinyLinkError)
                self.assertNotIsInstance(caught.exception, ValidationError)
        self.assertEqual(links.resolve("promo", T0, "v1"), url(1))

    def test_alias_cannot_clash_with_a_generated_code(self):
        links = TinyLink()
        generate(links, 10)  # 000001 .. 000009, 00000A
        with self.assertRaises(AliasTakenError):
            links.create(URL, "bob", T0, alias="000001")
        with self.assertRaises(AliasTakenError):
            links.create(URL, "bob", T0, alias="00000a")
        self.assertEqual(links.create(URL, "bob", T0, alias="00000b"), "00000b")
        self.assertEqual(links.create(URL, "bob", T0), "00000C")

    def test_generated_codes_are_case_sensitive_but_aliases_are_not(self):
        links = TinyLink()
        codes = generate(links, 10)
        self.assertEqual(links.resolve("00000A", T0, "v1"), url(9))
        with self.assertRaises(LinkNotFoundError):
            links.resolve("00000a", T0, "v1")
        self.assertEqual(codes[9], "00000A")
        links.create(URL, "alice", T0, alias="Spring-Sale")
        self.assertEqual(links.resolve("SPRING-SALE", T0, "v1"), URL)
        self.assertEqual(links.resolve("spring-sALE", T0, "v1"), URL)
        with self.assertRaises(LinkNotFoundError):
            links.resolve("Spring-Sal", T0, "v1")


class ResolveAndOrderTests(unittest.TestCase):
    def test_unknown_codes_raise_link_not_found(self):
        links = TinyLink()
        with self.assertRaises(LinkNotFoundError):
            links.resolve("000001", T0, "v1")
        links.create(URL, "alice", T0)
        for code in ["000002", "00001", "1", ""]:
            with self.subTest(code=code):
                with self.assertRaises(LinkNotFoundError) as caught:
                    links.resolve(code, T0, "v1")
                self.assertIsInstance(caught.exception, TinyLinkError)

    def test_create_reports_the_first_problem_and_failures_change_nothing(self):
        links = TinyLink()
        links.create(URL, "bob", T0, alias="taken")
        with self.assertRaises(InvalidUrlError):
            links.create("ftp://x.com", "alice", T0, alias="a")
        with self.assertRaises(InvalidUrlError):
            links.create("ftp://x.com", "alice", T0, alias="taken")
        with self.assertRaises(InvalidAliasError):
            links.create(URL, "alice", T0, alias="a!")
        with self.assertRaises(AliasTakenError):
            links.create(URL, "alice", T0, alias="TAKEN")
        self.assertEqual(links.create(URL, "alice", T0), "000001")


class ExpiryTests(unittest.TestCase):
    def test_link_resolves_until_expiry_and_fails_from_expiry_on(self):
        links = TinyLink()
        code = links.create(URL, "alice", T0, expires_at=T0 + 5000)
        forever = links.create(url(2), "alice", T0)
        self.assertEqual(links.resolve(code, T0 + 4999, "v1"), URL)
        for now in [T0 + 5000, T0 + 999_999]:
            with self.subTest(now=now):
                with self.assertRaises(LinkExpiredError) as caught:
                    links.resolve(code, now, "v1")
                self.assertIsInstance(caught.exception, TinyLinkError)
        self.assertEqual(links.resolve(forever, T0 + 10**12, "v1"), url(2))

    def test_expiry_must_be_strictly_after_now(self):
        links = TinyLink()
        for expires_at in [T0, T0 - 1]:
            with self.subTest(expires_at=expires_at):
                with self.assertRaises(InvalidExpiryError) as caught:
                    links.create(URL, "alice", T0, expires_at=expires_at)
                self.assertIsInstance(caught.exception, ValidationError)
        code = links.create(URL, "alice", T0, expires_at=T0 + 1)
        self.assertEqual(code, "000001")
        self.assertEqual(links.resolve(code, T0, "v1"), URL)
        with self.assertRaises(LinkExpiredError):
            links.resolve(code, T0 + 1, "v1")

    def test_expired_resolve_records_no_click_and_alias_stays_taken(self):
        links = TinyLink()
        links.create(URL, "alice", T0, alias="flash", expires_at=T0 + 100)
        links.resolve("flash", T0 + 50, "v1")
        with self.assertRaises(LinkExpiredError):
            links.resolve("flash", T0 + 100, "v2")
        stats = links.stats("flash")
        self.assertEqual(stats.total_clicks, 1)
        self.assertEqual(stats.unique_visitors, 1)
        with self.assertRaises(AliasTakenError):
            links.create(url(2), "bob", T0 + 200, alias="FLASH")


class StatsTests(unittest.TestCase):
    def test_unique_visitors_are_compared_exactly(self):
        links = TinyLink()
        code = links.create(URL, "alice", T0)
        empty = links.stats(code)
        self.assertEqual((empty.total_clicks, empty.unique_visitors, empty.clicks_by_day), (0, 0, {}))
        for visitor in ["v1", "v1", "V1", "v2", "v1 "]:
            links.resolve(code, T0 + 1, visitor)
        stats = links.stats(code)
        self.assertEqual(stats.total_clicks, 5)
        self.assertEqual(stats.unique_visitors, 4)

    def test_clicks_by_day_uses_utc_day_boundaries(self):
        links = TinyLink()
        day0 = 19_000 * DAY
        code = links.create(URL, "alice", day0 - 10)
        for now in [day0 - 1, day0, day0 + DAY - 1, day0 + DAY, day0 + 3 * DAY + 5]:
            links.resolve(code, now, "v1")
        stats = links.stats(code)
        self.assertEqual(stats.clicks_by_day, {18_999: 1, 19_000: 2, 19_001: 1, 19_003: 1})
        self.assertEqual(stats.total_clicks, 5)
        self.assertEqual(stats.unique_visitors, 1)

    def test_stats_uses_the_same_lookup_as_resolve(self):
        links = TinyLink()
        links.create(URL, "alice", T0, alias="Promo")
        links.resolve("promo", T0, "v1")
        self.assertEqual(links.stats("PROMO").total_clicks, 1)
        generate(links, 10)
        self.assertEqual(links.stats("00000A").total_clicks, 0)
        for code in ["nope", "00000a"]:
            with self.subTest(code=code):
                with self.assertRaises(LinkNotFoundError):
                    links.stats(code)


class QuotaTests(unittest.TestCase):
    def test_quota_caps_active_links_per_owner(self):
        links = TinyLink(max_links_per_owner=2)
        links.create(url(1), "alice", T0)
        links.create(url(2), "alice", T0, alias="second")
        with self.assertRaises(QuotaExceededError) as caught:
            links.create(url(3), "alice", T0)
        self.assertIsInstance(caught.exception, TinyLinkError)
        self.assertNotIsInstance(caught.exception, ValidationError)
        links.create(url(4), "bob", T0)
        links.create(url(5), "bob", T0)
        with self.assertRaises(QuotaExceededError):
            links.create(url(6), "bob", T0, alias="third")

    def test_expired_links_do_not_count_toward_the_quota(self):
        links = TinyLink(max_links_per_owner=1)
        links.create(url(1), "alice", T0, expires_at=T0 + 5000)
        with self.assertRaises(QuotaExceededError):
            links.create(url(2), "alice", T0 + 4999)
        self.assertEqual(links.create(url(3), "alice", T0 + 5000), "000002")

    def test_rejected_create_reserves_nothing(self):
        links = TinyLink(max_links_per_owner=1)
        self.assertEqual(links.create(url(1), "alice", T0), "000001")
        with self.assertRaises(QuotaExceededError):
            links.create(url(2), "alice", T0, alias="summer")
        with self.assertRaises(QuotaExceededError):
            links.create(url(3), "alice", T0)
        self.assertEqual(links.create(url(4), "bob", T0, alias="Summer"), "Summer")
        self.assertEqual(links.create(url(5), "carol", T0), "000002")

    def test_create_check_order_with_expiry_and_quota(self):
        links = TinyLink(max_links_per_owner=1)
        links.create(url(1), "alice", T0)
        links.create(url(2), "bob", T0, alias="taken")
        with self.assertRaises(AliasTakenError):
            links.create(URL, "alice", T0, alias="taken")
        with self.assertRaises(InvalidExpiryError):
            links.create(URL, "alice", T0, alias="taken", expires_at=T0)
        with self.assertRaises(InvalidAliasError):
            links.create(URL, "alice", T0, alias="no!", expires_at=T0)
        with self.assertRaises(InvalidUrlError):
            links.create("nope", "alice", T0, alias="no!", expires_at=T0)
        with self.assertRaises(InvalidExpiryError):
            links.create(URL, "alice", T0, expires_at=T0 - 5)
        with self.assertRaises(QuotaExceededError):
            links.create(URL, "alice", T0, alias="fresh", expires_at=T0 + 1)


class DeleteRestoreTests(unittest.TestCase):
    def test_deleted_link_stops_resolving_but_keeps_its_stats(self):
        links = TinyLink()
        links.create(URL, "alice", T0, alias="gone", expires_at=T0 + 1000)
        links.resolve("gone", T0 + 1, "v1")
        links.delete("GONE")
        for now in [T0 + 2, T0 + 5000]:  # deleted wins over expired
            with self.subTest(now=now):
                with self.assertRaises(LinkDeletedError) as caught:
                    links.resolve("gone", now, "v2")
                self.assertIsInstance(caught.exception, TinyLinkError)
        self.assertEqual(links.stats("gone").total_clicks, 1)
        with self.assertRaises(LinkDeletedError):
            links.delete("gone")
        with self.assertRaises(LinkNotFoundError):
            links.delete("never")

    def test_delete_frees_the_quota_slot_and_releases_the_alias(self):
        links = TinyLink(max_links_per_owner=1)
        links.create(url(1), "alice", T0, alias="launch")
        links.delete("launch")
        self.assertEqual(links.create(url(2), "alice", T0 + 1), "000001")
        self.assertEqual(links.create(url(3), "bob", T0 + 2, alias="LAUNCH"), "LAUNCH")
        self.assertEqual(links.resolve("launch", T0 + 3, "v1"), url(3))

    def test_restore_keeps_clicks_and_expiry(self):
        links = TinyLink()
        links.create(URL, "alice", T0, alias="promo", expires_at=T0 + 10_000)
        links.resolve("promo", T0 + 1, "v1")
        links.delete("promo")
        self.assertIsNone(links.restore("PROMO", T0 + 2))
        self.assertEqual(links.resolve("promo", T0 + 3, "v2"), URL)
        stats = links.stats("promo")
        self.assertEqual((stats.total_clicks, stats.unique_visitors), (2, 2))
        with self.assertRaises(LinkExpiredError):
            links.resolve("promo", T0 + 10_000, "v3")
        code = links.create(url(2), "alice", T0 + 20_000)
        links.delete(code)
        links.restore(code, T0 + 20_001)
        self.assertEqual(links.resolve(code, T0 + 20_002, "v1"), url(2))

    def test_restore_conflicts_when_the_code_is_held_by_a_live_link(self):
        links = TinyLink()
        live = links.create(url(1), "alice", T0)
        with self.assertRaises(RestoreConflictError) as caught:
            links.restore(live, T0)
        self.assertIsInstance(caught.exception, TinyLinkError)
        with self.assertRaises(LinkNotFoundError):
            links.restore("nope", T0)
        links.create(url(2), "alice", T0, alias="promo")
        links.delete("promo")
        links.create(url(3), "bob", T0 + 1, alias="Promo")
        with self.assertRaises(RestoreConflictError):
            links.restore("promo", T0 + 2)
        self.assertEqual(links.resolve("promo", T0 + 3, "v1"), url(3))
        links.delete(live)
        self.assertEqual(links.create(url(4), "carol", T0 + 4, alias=live), live)
        with self.assertRaises(RestoreConflictError):
            links.restore(live, T0 + 5)
        self.assertEqual(links.resolve(live, T0 + 6, "v1"), url(4))

    def test_restore_respects_the_quota_unless_the_link_has_expired(self):
        links = TinyLink(max_links_per_owner=1)
        links.create(url(1), "alice", T0, alias="flash", expires_at=T0 + 1000)
        links.delete("flash")
        links.create(url(2), "alice", T0 + 100)
        with self.assertRaises(QuotaExceededError):
            links.restore("flash", T0 + 200)
        with self.assertRaises(LinkDeletedError):
            links.resolve("flash", T0 + 200, "v1")
        links.restore("flash", T0 + 1000)
        with self.assertRaises(LinkExpiredError):
            links.resolve("flash", T0 + 1000, "v1")

    def test_lookup_prefers_a_live_link_then_the_most_recently_deleted(self):
        links = TinyLink()
        links.create(url(1), "alice", T0, alias="promo")
        for _ in range(3):
            links.resolve("promo", T0 + 1, "v1")
        links.delete("promo")
        links.create(url(2), "bob", T0 + 2, alias="PROMO")
        self.assertEqual(links.stats("promo").total_clicks, 0)
        links.delete("promo")
        with self.assertRaises(LinkDeletedError):
            links.resolve("Promo", T0 + 3, "v1")
        links.restore("promo", T0 + 4)
        self.assertEqual(links.resolve("promo", T0 + 5, "v1"), url(2))
        self.assertEqual(links.stats("promo").total_clicks, 1)


class TopLinksTests(unittest.TestCase):
    def test_top_links_ranks_by_clicks_since_inclusive_with_creation_order_ties(self):
        links = TinyLink()
        a, b, c = generate(links, 3)
        d = links.create(URL, "alice", T0, alias="d-link")
        plan = [
            (a, [T0 + 1000, T0 + 1500, T0 + 2000]),
            (b, [T0 + 999, T0 + 1000]),
            (c, [T0, T0 + 999]),
            (d, [T0 + 5000, T0 + 6000]),
        ]
        for now, code in sorted((now, code) for code, times in plan for now in times):
            links.resolve(code, now, "v1")
        self.assertEqual(links.top_links("alice", 10, T0 + 1000), [(a, 3), (d, 2), (b, 1)])
        self.assertEqual(links.top_links("alice", 2, T0 + 1000), [(a, 3), (d, 2)])
        self.assertEqual(links.top_links("alice", 10, T0), [(a, 3), (b, 2), (c, 2), (d, 2)])

    def test_top_links_skips_deleted_and_other_owners_but_keeps_expired(self):
        links = TinyLink()
        x = links.create(url(1), "alice", T0, expires_at=T0 + 100)
        y = links.create(url(2), "alice", T0)
        z = links.create(url(3), "alice", T0, alias="zed")
        w = links.create(url(4), "bob", T0)
        now = T0 + 10
        for code, count in [(x, 2), (y, 1), (z, 3), (w, 5)]:
            for _ in range(count):
                links.resolve(code, now, "v1")
                now += 1
        links.delete(z)
        self.assertEqual(links.top_links("alice", 5, T0), [(x, 2), (y, 1)])
        links.restore(z, T0 + 300)
        self.assertEqual(links.top_links("alice", 5, T0), [(z, 3), (x, 2), (y, 1)])
        self.assertEqual(links.top_links("alice", 0, T0), [])
        self.assertEqual(links.top_links("nobody", 3, T0), [])


if __name__ == "__main__":
    unittest.main()
