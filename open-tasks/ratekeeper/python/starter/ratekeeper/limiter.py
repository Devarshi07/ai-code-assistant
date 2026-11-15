"""The RateKeeper limiter. See README.md for the full rules.

Units used throughout:
    now            integer milliseconds; never decreases between calls
    per_minute     tokens added per minute, continuously
    retry_after    whole seconds, rounded up
    daily quotas   day number = now // 86_400_000
"""
from .decision import Decision  # noqa: F401  (you will need it)
from .errors import (  # noqa: F401
    ConfigError,
    DuplicateClientError,
    UnknownClientError,
    UnknownPlanError,
    UnknownRouteError,
)


class RateKeeper:
    """In-memory, per-customer rate limiter for the API gateway."""

    def __init__(self, plans, penalty=None):
        """Validate and store the plan configuration.

        plans: {plan_name: {"limits": {pattern: {"capacity": int, "per_minute": int}},
                            "daily_quota": int | None  (optional, Part 2)}}
        penalty (Part 3): None, or {"strikes": N, "window_seconds": W, "block_seconds": B}.

        Raises ConfigError if a capacity, per_minute, daily_quota or penalty value
        isn't an integer >= 1 (daily_quota may also be missing or None), or if a
        pattern is malformed (Part 2).
        """
        raise NotImplementedError("RateKeeper.__init__")

    def register_client(self, client_id, plan):
        """Add a client on the named plan.

        Raises UnknownPlanError if the plan isn't defined, and
        DuplicateClientError if client_id is already registered.
        """
        raise NotImplementedError("RateKeeper.register_client")

    def check(self, client_id, route, now):
        """Decide one request from client_id to route at time now (ms).

        Returns a Decision. An allowed request takes one token from the bucket
        of the most specific matching rule and counts toward today's quota.
        A denied request takes nothing.

        Raises UnknownClientError for an unregistered client, and
        UnknownRouteError when no rule in the client's plan matches the route.
        """
        raise NotImplementedError("RateKeeper.check")

    def change_plan(self, client_id, plan, now):
        """Part 2: move client_id to another plan, effective at now (ms).

        Buckets whose pattern exists in the new plan carry over: refill to now at
        the old rate, then tokens = max(0, new_capacity - (old_capacity - tokens)).
        Other buckets are discarded. Today's quota count carries over.

        Raises UnknownClientError (checked first) or UnknownPlanError.
        """
        raise NotImplementedError("RateKeeper.change_plan")

    def usage(self, client_id, now):
        """Part 3: admin report for client_id at time now (ms). Changes nothing.

        Returns {"client_id", "plan", "day_used", "day_remaining",
        "blocked_until", "rules": [{"rule", "tokens", "allowed", "denied"}, ...]}
        with rules sorted by pattern. Raises UnknownClientError.
        """
        raise NotImplementedError("RateKeeper.usage")
