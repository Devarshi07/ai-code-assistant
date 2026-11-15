"""Hidden acceptance tests for RateKeeper. They use only the documented interface."""
import unittest

from ratekeeper import (
    ConfigError,
    DuplicateClientError,
    RateKeeper,
    RateKeeperError,
    UnknownClientError,
    UnknownPlanError,
    UnknownRouteError,
)

DAY = 86_400_000

PLANS = {
    "free": {
        "limits": {
            "/v1/search": {"capacity": 5, "per_minute": 10},   # one token every 6 s
            "/v1/orders": {"capacity": 2, "per_minute": 1},    # one token every 60 s
        },
    },
    "pro": {
        "limits": {
            "/v1/search": {"capacity": 20, "per_minute": 60},  # one token every second
            "/v1/orders": {"capacity": 10, "per_minute": 30},  # one token every 2 s
            "/v1/reports": {"capacity": 3, "per_minute": 6},   # one token every 10 s
        },
    },
}

GATEWAY = {
    "gateway": {
        "limits": {
            "/v1/users/me": {"capacity": 1, "per_minute": 60},
            "/v1/users/*": {"capacity": 3, "per_minute": 60},
            "/v1/*/status": {"capacity": 2, "per_minute": 60},
            "/v1/**": {"capacity": 4, "per_minute": 60},
            "/*/reports/daily": {"capacity": 2, "per_minute": 60},
            "/**": {"capacity": 9, "per_minute": 60},
        },
    },
}

SAME_LIMITS = {
    "/v1/search": {"capacity": 10, "per_minute": 60},
    "/v1/orders": {"capacity": 10, "per_minute": 60},
}
METERED = {
    "metered": {"daily_quota": 3, "limits": SAME_LIMITS},
    "bulk": {"daily_quota": 5, "limits": SAME_LIMITS},
    "tight": {"daily_quota": 3, "limits": {"/v1/search": {"capacity": 1, "per_minute": 60}}},
}

GUARDED = {
    "free": {
        "limits": {
            "/v1/search": {"capacity": 1, "per_minute": 60},
            "/v1/orders": {"capacity": 5, "per_minute": 60},
        },
    },
    "slow": {"limits": {"/v1/search": {"capacity": 1, "per_minute": 1}}},
    "pro": {
        "limits": {
            "/v1/search": {"capacity": 50, "per_minute": 600},
            "/v1/orders": {"capacity": 50, "per_minute": 600},
        },
    },
    "metered": {"daily_quota": 1, "limits": {"/v1/search": {"capacity": 5, "per_minute": 60}}},
}
PENALTY = {"strikes": 3, "window_seconds": 10, "block_seconds": 60}

REPORTING = {
    "metered": {
        "daily_quota": 5,
        "limits": {
            "/v1/search": {"capacity": 2, "per_minute": 60},
            "/v1/orders": {"capacity": 3, "per_minute": 30},
            "/v1/**": {"capacity": 4, "per_minute": 60},
        },
    },
    "open": {
        "limits": {
            "/v1/search": {"capacity": 10, "per_minute": 60},
            "/v2/**": {"capacity": 1, "per_minute": 60},
        },
    },
}


def keeper(plans=PLANS, clients=(("acme", "free"),), penalty=None):
    k = RateKeeper(plans) if penalty is None else RateKeeper(plans, penalty=penalty)
    for client_id, plan in clients:
        k.register_client(client_id, plan)
    return k


def solo(capacity, per_minute):
    return keeper({"solo": {"limits": {"/v1/ping": {"capacity": capacity, "per_minute": per_minute}}}},
                  clients=(("acme", "solo"),))


def view(decision):
    return (decision.allowed, decision.remaining, decision.retry_after, decision.reason)


def drain(k, client_id, route, now, times):
    for _ in range(times):
        assert k.check(client_id, route, now).allowed


# --------------------------------------------------------------------------- Part 1


class CoreBucketTests(unittest.TestCase):
    def test_new_bucket_starts_full_and_counts_down(self):
        k = keeper()
        for left in (4, 3, 2, 1, 0):
            decision = k.check("acme", "/v1/search", 0)
            self.assertEqual(view(decision), (True, left, 0, "ok"))
            self.assertEqual(decision.rule, "/v1/search")
        denied = k.check("acme", "/v1/search", 0)
        self.assertEqual(view(denied), (False, 0, 6, "rate_limited"))
        self.assertEqual(denied.rule, "/v1/search")

    def test_retry_after_rounds_up_to_whole_seconds(self):
        k = keeper()
        drain(k, "acme", "/v1/search", 0, 5)
        self.assertEqual(view(k.check("acme", "/v1/search", 1500)), (False, 0, 5, "rate_limited"))  # 4.5 s left
        self.assertEqual(view(k.check("acme", "/v1/search", 3000)), (False, 0, 3, "rate_limited"))  # exactly 3 s
        self.assertEqual(view(k.check("acme", "/v1/search", 5001)), (False, 0, 1, "rate_limited"))  # 0.999 s

    def test_tokens_arrive_exactly_on_schedule_and_denials_cost_nothing(self):
        k = keeper()
        drain(k, "acme", "/v1/search", 0, 5)
        for t in range(0, 5901, 100):
            self.assertEqual(view(k.check("acme", "/v1/search", t)), (False, 0, k_retry(t), "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 5999)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 6000)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 6000)), (False, 0, 6, "rate_limited"))

    def test_partial_tokens_carry_over_and_refill_is_capped(self):
        k = keeper()
        drain(k, "acme", "/v1/search", 0, 5)
        self.assertEqual(view(k.check("acme", "/v1/search", 9000)), (True, 0, 0, "ok"))       # 1.5 -> 0.5
        self.assertEqual(view(k.check("acme", "/v1/search", 11999)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 12000)), (True, 0, 0, "ok"))      # 0.5 + 0.5
        # Ten idle minutes would add 100 tokens, but the bucket stops at capacity.
        for left in (4, 3, 2, 1, 0):
            self.assertEqual(view(k.check("acme", "/v1/search", 612_000)), (True, left, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 612_000)), (False, 0, 6, "rate_limited"))

    def test_buckets_are_separate_per_client_and_per_route(self):
        k = keeper(clients=(("acme", "free"), ("globex", "free")))
        drain(k, "acme", "/v1/search", 0, 5)
        self.assertFalse(k.check("acme", "/v1/search", 0).allowed)
        self.assertEqual(view(k.check("globex", "/v1/search", 0)), (True, 4, 0, "ok"))
        orders = k.check("acme", "/v1/orders", 0)
        self.assertEqual(view(orders), (True, 1, 0, "ok"))
        self.assertEqual(orders.rule, "/v1/orders")
        self.assertEqual(view(k.check("acme", "/v1/orders", 0)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/orders", 0)), (False, 0, 60, "rate_limited"))

    def test_token_counts_are_exact_where_floats_drift(self):
        k = solo(1, 3)  # one token every 20 s; polling every 2 s adds 0.1 token each time
        self.assertEqual(view(k.check("acme", "/v1/ping", 0)), (True, 0, 0, "ok"))
        for t in range(2000, 20000, 2000):
            self.assertEqual(view(k.check("acme", "/v1/ping", t)), (False, 0, (20000 - t) // 1000, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 20000)), (True, 0, 0, "ok"))

    def test_rates_that_do_not_divide_a_minute(self):
        k = solo(2, 7)  # a token every 8571.43 ms
        self.assertEqual(view(k.check("acme", "/v1/ping", 0)), (True, 1, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 0)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 0)), (False, 0, 9, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 8571)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 8572)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 8572)), (False, 0, 9, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 17142)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/ping", 17143)), (True, 0, 0, "ok"))


def k_retry(t):
    """retry_after on the free search bucket emptied at t=0: ceil((6000 - t) / 1000)."""
    return -(-(6000 - t) // 1000)


class CoreErrorTests(unittest.TestCase):
    def test_client_registration_errors(self):
        k = keeper()
        with self.assertRaises(UnknownClientError):
            k.check("ghost", "/v1/search", 0)
        with self.assertRaises(UnknownPlanError):
            k.register_client("initech", "gold")
        with self.assertRaises(UnknownClientError):
            k.check("initech", "/v1/search", 0)
        with self.assertRaises(DuplicateClientError):
            k.register_client("acme", "pro")
        # acme is still on free: no /v1/reports rule and a capacity of 5.
        with self.assertRaises(UnknownRouteError):
            k.check("acme", "/v1/reports", 0)
        drain(k, "acme", "/v1/search", 0, 5)
        self.assertFalse(k.check("acme", "/v1/search", 0).allowed)
        for error in (UnknownClientError, UnknownPlanError, DuplicateClientError):
            self.assertTrue(issubclass(error, RateKeeperError), error.__name__)

    def test_route_without_a_rule_raises(self):
        k = keeper()
        for route in ("/v1/reports", "/v1/search/images", "/v1", "/v2/search"):
            with self.subTest(route=route), self.assertRaises(UnknownRouteError):
                k.check("acme", route, 0)
        self.assertTrue(issubclass(UnknownRouteError, RateKeeperError))
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (True, 4, 0, "ok"))

    def test_invalid_limits_raise_config_error(self):
        bad = [
            {"capacity": 0, "per_minute": 10},
            {"capacity": 5, "per_minute": 0},
            {"capacity": -1, "per_minute": 10},
            {"capacity": 2.5, "per_minute": 10},
            {"capacity": 5, "per_minute": 1.5},
        ]
        for limit in bad:
            with self.subTest(limit=limit), self.assertRaises(ConfigError):
                RateKeeper({"free": {"limits": {"/v1/search": limit}}})
        self.assertTrue(issubclass(ConfigError, RateKeeperError))


# --------------------------------------------------------------------------- Part 2


class RoutingTests(unittest.TestCase):
    def test_star_matches_exactly_one_segment(self):
        k = keeper({"p": {"limits": {"/v1/users/*": {"capacity": 3, "per_minute": 60}}}}, clients=(("acme", "p"),))
        first = k.check("acme", "/v1/users/42", 0)
        self.assertEqual((first.allowed, first.rule), (True, "/v1/users/*"))
        self.assertEqual(view(k.check("acme", "/v1/users/me", 0)), (True, 1, 0, "ok"))
        for route in ("/v1/users", "/v1/users/42/orders", "/v2/users/42"):
            with self.subTest(route=route), self.assertRaises(UnknownRouteError):
                k.check("acme", route, 0)

    def test_double_star_matches_one_or_more_segments(self):
        k = keeper({"p": {"limits": {"/v1/**": {"capacity": 10, "per_minute": 60}}}}, clients=(("acme", "p"),))
        for route in ("/v1/a", "/v1/a/b", "/v1/a/b/c/d"):
            decision = k.check("acme", route, 0)
            self.assertEqual((decision.allowed, decision.rule), (True, "/v1/**"), route)
        for route in ("/v1", "/v2/a", "/v10/a"):
            with self.subTest(route=route), self.assertRaises(UnknownRouteError):
                k.check("acme", route, 0)

    def test_most_specific_rule_wins(self):
        k = keeper(GATEWAY, clients=(("acme", "gateway"),))
        cases = [
            ("/v1/users/me", "/v1/users/me"),       # an exact match beats every wildcard
            ("/v1/users/42", "/v1/users/*"),
            ("/v1/users", "/v1/**"),
            ("/v1/users/42/orders", "/v1/**"),
            ("/v1", "/**"),
            ("/health", "/**"),
        ]
        for route, rule in cases:
            decision = k.check("acme", route, 0)
            self.assertEqual((decision.allowed, decision.rule), (True, rule), route)

    def test_specificity_is_decided_left_to_right(self):
        k = keeper(GATEWAY, clients=(("acme", "gateway"),))
        cases = [
            ("/v1/users/status", "/v1/users/*"),         # literal beats '*' at the 2nd segment
            ("/v1/reports/daily", "/v1/**"),             # literal beats '*' at the 1st segment
            ("/v1/orders/status", "/v1/*/status"),       # '*' beats '**' at the 2nd segment
            ("/v2/reports/daily", "/*/reports/daily"),   # '*' beats '**' at the 1st segment
        ]
        for route, rule in cases:
            decision = k.check("acme", route, 0)
            self.assertEqual((decision.allowed, decision.rule), (True, rule), route)

    def test_routes_matching_one_rule_share_a_bucket(self):
        k = keeper(GATEWAY, clients=(("acme", "gateway"),))
        for user, left in ((1, 2), (2, 1), (3, 0)):
            decision = k.check("acme", f"/v1/users/{user}", 0)
            self.assertEqual(view(decision), (True, left, 0, "ok"))
            self.assertEqual(decision.rule, "/v1/users/*")
        denied = k.check("acme", "/v1/users/4", 0)
        self.assertEqual(view(denied), (False, 0, 1, "rate_limited"))
        self.assertEqual(denied.rule, "/v1/users/*")
        self.assertEqual(view(k.check("acme", "/v1/users/me", 0)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/users/4", 1000)), (True, 0, 0, "ok"))

    def test_invalid_patterns_and_quotas_raise_config_error(self):
        limit = {"capacity": 1, "per_minute": 1}
        for pattern in ("v1/search", "/v1//search", "/v1/search/", "/", "/v1/**/items", "/v1/se*", "/v1/***"):
            with self.subTest(pattern=pattern), self.assertRaises(ConfigError):
                RateKeeper({"p": {"limits": {pattern: limit}}})
        for quota in (0, -5, 2.5):
            with self.subTest(quota=quota), self.assertRaises(ConfigError):
                RateKeeper({"p": {"daily_quota": quota, "limits": {"/v1/x": limit}}})
        # Valid configurations are accepted.
        RateKeeper({"p": {"daily_quota": None, "limits": {"/**": limit, "/v1/*/x": limit, "/*": limit}}})


class DailyQuotaTests(unittest.TestCase):
    def test_quota_counts_allowed_requests_across_routes(self):
        k = keeper(METERED, clients=(("acme", "metered"),))
        self.assertEqual(view(k.check("acme", "/v1/search", 1000)), (True, 9, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/orders", 2000)), (True, 9, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 3000)), (True, 9, 0, "ok"))
        over = k.check("acme", "/v1/orders", 4000)
        self.assertEqual(view(over), (False, 10, 86_396, "quota_exceeded"))
        self.assertEqual(over.rule, "/v1/orders")
        self.assertEqual(view(k.check("acme", "/v1/search", 5000)), (False, 10, 86_395, "quota_exceeded"))

    def test_quota_resets_exactly_at_the_day_boundary(self):
        k = keeper(METERED, clients=(("acme", "metered"),))
        for t in (DAY - 10_000, DAY - 9_000, DAY - 8_000):
            self.assertTrue(k.check("acme", "/v1/search", t).allowed)
        self.assertEqual(view(k.check("acme", "/v1/search", DAY - 1)), (False, 10, 1, "quota_exceeded"))
        for left in (9, 8, 7):
            self.assertEqual(view(k.check("acme", "/v1/search", DAY)), (True, left, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", DAY)), (False, 7, 86_400, "quota_exceeded"))

    def test_denied_requests_do_not_use_quota(self):
        k = keeper(METERED, clients=(("acme", "tight"),))
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (True, 0, 0, "ok"))
        for t in (0, 200, 400):
            self.assertEqual(view(k.check("acme", "/v1/search", t)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 1000)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 2000)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 3000)), (False, 1, 86_397, "quota_exceeded"))

    def test_quota_is_checked_before_the_bucket(self):
        k = keeper(METERED, clients=(("acme", "tight"),))
        for t in (0, 1000, 2000):
            self.assertTrue(k.check("acme", "/v1/search", t).allowed)
        self.assertEqual(view(k.check("acme", "/v1/search", 2000)), (False, 0, 86_398, "quota_exceeded"))
        self.assertEqual(view(k.check("acme", "/v1/search", 2500)), (False, 0, 86_398, "quota_exceeded"))


class PlanChangeTests(unittest.TestCase):
    def test_upgrade_keeps_spent_tokens_spent(self):
        k = keeper()
        drain(k, "acme", "/v1/search", 0, 3)
        k.change_plan("acme", "pro", 0)
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (True, 16, 0, "ok"))   # 20 - 3 spent - 1
        reports = k.check("acme", "/v1/reports", 0)                                       # new rule starts full
        self.assertEqual(view(reports), (True, 2, 0, "ok"))
        self.assertEqual(reports.rule, "/v1/reports")

    def test_plan_change_settles_refill_at_the_old_rate_first(self):
        k = keeper()
        drain(k, "acme", "/v1/search", 0, 5)
        k.change_plan("acme", "pro", 9000)   # 1.5 tokens on free -> 3.5 spent -> 16.5 on pro
        self.assertEqual(view(k.check("acme", "/v1/search", 9000)), (True, 15, 0, "ok"))   # 15.5 left
        self.assertEqual(view(k.check("acme", "/v1/search", 9500)), (True, 15, 0, "ok"))   # +0.5 at pro rate

    def test_downgrade_never_goes_below_zero_and_uses_the_new_rate(self):
        k = keeper(clients=(("acme", "pro"),))
        drain(k, "acme", "/v1/search", 0, 12)
        drain(k, "acme", "/v1/orders", 0, 1)
        k.change_plan("acme", "free", 0)
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (False, 0, 6, "rate_limited"))  # max(0, 5 - 12)
        self.assertEqual(view(k.check("acme", "/v1/orders", 0)), (True, 0, 0, "ok"))             # 2 - 1 spent
        self.assertEqual(view(k.check("acme", "/v1/search", 6000)), (True, 0, 0, "ok"))

    def test_buckets_missing_from_the_new_plan_are_dropped(self):
        k = keeper(clients=(("acme", "pro"),))
        drain(k, "acme", "/v1/reports", 0, 3)
        k.change_plan("acme", "free", 0)
        with self.assertRaises(UnknownRouteError):
            k.check("acme", "/v1/reports", 0)
        k.change_plan("acme", "pro", 1000)
        self.assertEqual(view(k.check("acme", "/v1/reports", 1000)), (True, 2, 0, "ok"))

    def test_change_plan_errors_leave_the_client_unchanged(self):
        k = keeper()
        with self.assertRaises(UnknownClientError):
            k.change_plan("ghost", "pro", 0)
        with self.assertRaises(UnknownPlanError):
            k.change_plan("acme", "gold", 0)
        with self.assertRaises(UnknownRouteError):
            k.check("acme", "/v1/reports", 0)
        drain(k, "acme", "/v1/search", 0, 5)
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (False, 0, 6, "rate_limited"))

    def test_daily_usage_carries_over_and_the_new_quota_applies_at_once(self):
        k = keeper(METERED, clients=(("acme", "metered"),))
        for t in (1000, 2000, 3000):
            self.assertTrue(k.check("acme", "/v1/search", t).allowed)
        self.assertEqual(k.check("acme", "/v1/search", 4000).reason, "quota_exceeded")
        k.change_plan("acme", "bulk", 5000)
        self.assertEqual(view(k.check("acme", "/v1/search", 5000)), (True, 9, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 6000)), (True, 9, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 7000)), (False, 10, 86_393, "quota_exceeded"))
        k.change_plan("acme", "metered", 8000)
        self.assertEqual(view(k.check("acme", "/v1/search", 8000)), (False, 10, 86_392, "quota_exceeded"))


# --------------------------------------------------------------------------- Part 3


def trip(k, client_id="acme"):
    """free plan on GUARDED with PENALTY: allowed at 0, strikes at 0, 100 and 200."""
    assert k.check(client_id, "/v1/search", 0).allowed
    first = k.check(client_id, "/v1/search", 0)
    second = k.check(client_id, "/v1/search", 100)
    third = k.check(client_id, "/v1/search", 200)
    return first, second, third


class PenaltyTests(unittest.TestCase):
    def test_strikes_inside_the_window_block_every_route(self):
        k = keeper(GUARDED, penalty=PENALTY)
        first, second, third = trip(k)
        self.assertEqual(view(first), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(second), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(third), (False, 0, 60, "blocked"))              # blocked until 60 200
        orders = k.check("acme", "/v1/orders", 1000)
        self.assertEqual(view(orders), (False, 5, 60, "blocked"))             # 59.2 s left
        self.assertEqual(orders.rule, "/v1/orders")
        self.assertEqual(k.usage("acme", 30_000)["blocked_until"], 60_200)
        self.assertEqual(view(k.check("acme", "/v1/search", 60_199)), (False, 1, 1, "blocked"))
        self.assertEqual(view(k.check("acme", "/v1/search", 60_200)), (True, 0, 0, "ok"))
        self.assertIsNone(k.usage("acme", 60_200)["blocked_until"])

    def test_strikes_older_than_the_window_do_not_count(self):
        k = keeper(GUARDED, clients=(("acme", "slow"),), penalty=PENALTY)
        self.assertTrue(k.check("acme", "/v1/search", 0).allowed)
        self.assertEqual(view(k.check("acme", "/v1/search", 1000)), (False, 0, 59, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 6000)), (False, 0, 54, "rate_limited"))
        # The window at 11 000 is (1 000, 11 000]: the strike at 1 000 has just left it.
        self.assertEqual(view(k.check("acme", "/v1/search", 11_000)), (False, 0, 49, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 11_001)), (False, 0, 60, "blocked"))

    def test_blocked_requests_are_not_strikes_and_a_block_clears_the_history(self):
        k = keeper(GUARDED, penalty={"strikes": 3, "window_seconds": 60, "block_seconds": 5})
        *_, third = trip(k)
        self.assertEqual(view(third), (False, 0, 5, "blocked"))               # blocked until 5 200
        for t in (1000, 2000, 3000, 4000, 5000):
            expected = -(-(5200 - t) // 1000)
            self.assertEqual(view(k.check("acme", "/v1/search", t)), (False, 1, expected, "blocked"))
        self.assertEqual(view(k.check("acme", "/v1/search", 5200)), (True, 0, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 5200)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 5300)), (False, 0, 1, "rate_limited"))
        self.assertEqual(view(k.check("acme", "/v1/search", 5400)), (False, 0, 5, "blocked"))

    def test_plan_changes_do_not_lift_a_block(self):
        k = keeper(GUARDED, penalty=PENALTY)
        trip(k)
        k.change_plan("acme", "pro", 20_000)
        self.assertEqual(view(k.check("acme", "/v1/search", 20_000)), (False, 50, 41, "blocked"))
        self.assertEqual(view(k.check("acme", "/v1/search", 60_200)), (True, 49, 0, "ok"))

    def test_quota_denials_are_strikes_too(self):
        k = keeper(GUARDED, clients=(("acme", "metered"),),
                   penalty={"strikes": 2, "window_seconds": 10, "block_seconds": 30})
        self.assertEqual(view(k.check("acme", "/v1/search", 0)), (True, 4, 0, "ok"))
        self.assertEqual(view(k.check("acme", "/v1/search", 1000)), (False, 5, 86_399, "quota_exceeded"))
        self.assertEqual(view(k.check("acme", "/v1/search", 2000)), (False, 5, 30, "blocked"))
        self.assertEqual(view(k.check("acme", "/v1/search", 31_999)), (False, 5, 1, "blocked"))
        self.assertEqual(view(k.check("acme", "/v1/search", 32_000)), (False, 5, 86_368, "quota_exceeded"))

    def test_invalid_penalty_raises_config_error(self):
        bad = [
            {"strikes": 0, "window_seconds": 10, "block_seconds": 60},
            {"strikes": 3, "window_seconds": 0, "block_seconds": 60},
            {"strikes": 3, "window_seconds": 10, "block_seconds": -1},
            {"strikes": 3, "window_seconds": 1.5, "block_seconds": 60},
        ]
        for penalty in bad:
            with self.subTest(penalty=penalty), self.assertRaises(ConfigError):
                RateKeeper(GUARDED, penalty=penalty)


class UsageTests(unittest.TestCase):
    def test_usage_reports_quota_and_every_rule(self):
        k = keeper(REPORTING, clients=(("acme", "metered"),))
        self.assertTrue(k.check("acme", "/v1/search", 0).allowed)
        self.assertTrue(k.check("acme", "/v1/search", 0).allowed)
        self.assertFalse(k.check("acme", "/v1/search", 0).allowed)
        self.assertTrue(k.check("acme", "/v1/orders", 500).allowed)
        self.assertEqual(k.check("acme", "/v1/other", 500).rule, "/v1/**")
        expected = {
            "client_id": "acme",
            "plan": "metered",
            "day_used": 4,
            "day_remaining": 1,
            "blocked_until": None,
            "rules": [
                {"rule": "/v1/**", "tokens": 3, "allowed": 1, "denied": 0},
                {"rule": "/v1/orders", "tokens": 2, "allowed": 1, "denied": 0},
                {"rule": "/v1/search", "tokens": 1, "allowed": 2, "denied": 1},
            ],
        }
        self.assertEqual(k.usage("acme", 1000), expected)
        self.assertEqual(k.usage("acme", 1000), expected)   # reading the report changes nothing
        self.assertEqual(view(k.check("acme", "/v1/search", 1000)), (True, 0, 0, "ok"))

    def test_usage_resets_daily_counts_and_follows_plan_changes(self):
        k = keeper(REPORTING, clients=(("acme", "metered"),))
        self.assertTrue(k.check("acme", "/v1/search", 0).allowed)
        self.assertTrue(k.check("acme", "/v1/search", 0).allowed)
        next_day = k.usage("acme", DAY + 5)
        self.assertEqual((next_day["day_used"], next_day["day_remaining"]), (0, 5))
        k.change_plan("acme", "open", DAY + 5)
        self.assertTrue(k.check("acme", "/v2/a", DAY + 5).allowed)
        self.assertEqual(k.usage("acme", DAY + 5), {
            "client_id": "acme",
            "plan": "open",
            "day_used": 1,
            "day_remaining": None,
            "blocked_until": None,
            "rules": [
                {"rule": "/v1/search", "tokens": 10, "allowed": 2, "denied": 0},
                {"rule": "/v2/**", "tokens": 0, "allowed": 1, "denied": 0},
            ],
        })
        with self.assertRaises(UnknownClientError):
            k.usage("ghost", 0)


if __name__ == "__main__":
    unittest.main()
