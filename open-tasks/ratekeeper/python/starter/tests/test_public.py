"""Provided tests: the basic happy path. Hidden acceptance tests cover much more."""
import unittest

from ratekeeper import RateKeeper, UnknownClientError

PLANS = {
    "free": {
        "limits": {
            "/v1/search": {"capacity": 5, "per_minute": 10},   # one token every 6 s
            "/v1/orders": {"capacity": 2, "per_minute": 1},    # one token every 60 s
        },
    },
    "pro": {
        "daily_quota": 2,
        "limits": {
            "/v1/search": {"capacity": 20, "per_minute": 60},
            "/v1/users/*": {"capacity": 3, "per_minute": 60},
        },
    },
}


def view(decision):
    return (decision.allowed, decision.remaining, decision.retry_after, decision.reason)


class PublicTests(unittest.TestCase):
    def setUp(self):
        self.keeper = RateKeeper(PLANS)
        self.keeper.register_client("acme", "free")

    def test_allows_up_to_capacity_then_rate_limits(self):
        for left in (4, 3, 2, 1, 0):
            decision = self.keeper.check("acme", "/v1/search", 0)
            self.assertEqual(view(decision), (True, left, 0, "ok"))
            self.assertEqual(decision.rule, "/v1/search")
        denied = self.keeper.check("acme", "/v1/search", 0)
        self.assertFalse(denied.allowed)
        self.assertEqual(denied.reason, "rate_limited")

    def test_bucket_refills_over_time(self):
        for _ in range(5):
            self.keeper.check("acme", "/v1/search", 0)
        self.assertEqual(view(self.keeper.check("acme", "/v1/search", 6000)), (True, 0, 0, "ok"))
        # 30 more seconds at 10 tokens per minute adds 5 tokens.
        self.assertEqual(view(self.keeper.check("acme", "/v1/search", 36000)), (True, 4, 0, "ok"))

    def test_each_client_has_its_own_bucket(self):
        self.keeper.register_client("globex", "free")
        for _ in range(5):
            self.keeper.check("acme", "/v1/search", 0)
        self.assertFalse(self.keeper.check("acme", "/v1/search", 0).allowed)
        self.assertEqual(view(self.keeper.check("globex", "/v1/search", 0)), (True, 4, 0, "ok"))

    def test_unknown_client_is_rejected(self):
        with self.assertRaises(UnknownClientError):
            self.keeper.check("nobody", "/v1/search", 0)

    def test_wildcard_rule_matches_route(self):
        self.keeper.register_client("initech", "pro")
        decision = self.keeper.check("initech", "/v1/users/42", 0)
        self.assertEqual(view(decision), (True, 2, 0, "ok"))
        self.assertEqual(decision.rule, "/v1/users/*")

    def test_daily_quota_stops_requests(self):
        self.keeper.register_client("initech", "pro")
        self.assertTrue(self.keeper.check("initech", "/v1/search", 1000).allowed)
        self.assertTrue(self.keeper.check("initech", "/v1/search", 2000).allowed)
        third = self.keeper.check("initech", "/v1/search", 3000)
        self.assertFalse(third.allowed)
        self.assertEqual(third.reason, "quota_exceeded")


if __name__ == "__main__":
    unittest.main()
