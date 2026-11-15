"""The RateKeeper limiter (reference solution).

Buckets are measured in integer units: 1 token = 60 000 units, so each
millisecond adds exactly `per_minute` units and every value stays an integer.
"""
from collections import deque

from .decision import BLOCKED, OK, QUOTA_EXCEEDED, RATE_LIMITED, Decision
from .errors import (
    ConfigError,
    DuplicateClientError,
    UnknownClientError,
    UnknownPlanError,
    UnknownRouteError,
)
from .patterns import Pattern

UNITS = 60_000
DAY_MS = 86_400_000


def _ceil_div(a, b):
    return -(-a // b)


def _positive_int(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


class _Rule:
    __slots__ = ("pattern", "capacity", "per_minute")

    def __init__(self, text, limit):
        if not isinstance(limit, dict):
            raise ConfigError(f"limit for {text!r} must be a dict")
        capacity, per_minute = limit.get("capacity"), limit.get("per_minute")
        if not _positive_int(capacity) or not _positive_int(per_minute):
            raise ConfigError(f"{text!r}: capacity and per_minute must be integers >= 1")
        self.pattern = Pattern(text)
        self.capacity = capacity * UNITS
        self.per_minute = per_minute


class _Plan:
    def __init__(self, name, spec):
        if not isinstance(spec, dict) or not isinstance(spec.get("limits"), dict):
            raise ConfigError(f"plan {name!r} needs a 'limits' dict")
        quota = spec.get("daily_quota")
        if quota is not None and not _positive_int(quota):
            raise ConfigError(f"plan {name!r}: daily_quota must be an integer >= 1 or None")
        self.daily_quota = quota
        self.rules = {text: _Rule(text, limit) for text, limit in spec["limits"].items()}

    def match(self, route):
        segments = route.split("/")[1:]
        best = None
        for rule in self.rules.values():
            if rule.pattern.matches(segments) and (best is None or rule.pattern.rank < best.pattern.rank):
                best = rule
        if best is None:
            raise UnknownRouteError(f"no rule matches {route!r}")
        return best


class _Bucket:
    __slots__ = ("units", "updated")

    def __init__(self, units, now):
        self.units = units
        self.updated = now

    def level(self, rule, now):
        """Units in the bucket at `now`, without changing it."""
        elapsed = max(0, now - self.updated)
        return min(rule.capacity, self.units + elapsed * rule.per_minute)

    def refill(self, rule, now):
        self.units = self.level(rule, now)
        self.updated = max(self.updated, now)


class _Penalty:
    def __init__(self, spec):
        if not isinstance(spec, dict):
            raise ConfigError("penalty must be a dict or None")
        values = [spec.get(key) for key in ("strikes", "window_seconds", "block_seconds")]
        if not all(_positive_int(v) for v in values):
            raise ConfigError("penalty strikes, window_seconds and block_seconds must be integers >= 1")
        self.strikes, window_seconds, self.block_seconds = values
        self.window_ms = window_seconds * 1000


class _Client:
    def __init__(self, plan):
        self.plan = plan
        self.buckets = {}      # pattern text -> _Bucket
        self.counts = {}       # pattern text -> [allowed, denied]
        self.day = None
        self.day_used = 0
        self.strikes = deque()
        self.blocked_until = None

    def used_on(self, day):
        return self.day_used if self.day == day else 0

    def blocked_at(self, now):
        return self.blocked_until is not None and now < self.blocked_until


class RateKeeper:
    """In-memory, per-customer rate limiter for the API gateway."""

    def __init__(self, plans, penalty=None):
        if not isinstance(plans, dict):
            raise ConfigError("plans must be a dict")
        self._plans = {name: _Plan(name, spec) for name, spec in plans.items()}
        self._penalty = None if penalty is None else _Penalty(penalty)
        self._clients = {}

    def register_client(self, client_id, plan):
        if plan not in self._plans:
            raise UnknownPlanError(f"unknown plan {plan!r}")
        if client_id in self._clients:
            raise DuplicateClientError(f"client {client_id!r} is already registered")
        self._clients[client_id] = _Client(plan)

    def _client(self, client_id):
        try:
            return self._clients[client_id]
        except KeyError:
            raise UnknownClientError(f"unknown client {client_id!r}") from None

    def check(self, client_id, route, now):
        client = self._client(client_id)
        plan = self._plans[client.plan]
        rule = plan.match(route)
        text = rule.pattern.text
        bucket = client.buckets.get(text)
        if bucket is None:
            bucket = client.buckets[text] = _Bucket(rule.capacity, now)
        bucket.refill(rule, now)
        counts = client.counts.setdefault(text, [0, 0])

        if client.blocked_at(now):
            counts[1] += 1
            return Decision(False, bucket.units // UNITS, _ceil_div(client.blocked_until - now, 1000), BLOCKED, text)

        day = now // DAY_MS
        if client.day != day:
            client.day, client.day_used = day, 0
        if plan.daily_quota is not None and client.day_used >= plan.daily_quota:
            reason, retry_after = QUOTA_EXCEEDED, _ceil_div((day + 1) * DAY_MS - now, 1000)
        elif bucket.units < UNITS:
            reason, retry_after = RATE_LIMITED, _ceil_div(UNITS - bucket.units, rule.per_minute * 1000)
        else:
            bucket.units -= UNITS
            client.day_used += 1
            counts[0] += 1
            return Decision(True, bucket.units // UNITS, 0, OK, text)

        counts[1] += 1
        if self._penalty is not None and self._strike(client, now):
            reason, retry_after = BLOCKED, self._penalty.block_seconds
        return Decision(False, bucket.units // UNITS, retry_after, reason, text)

    def _strike(self, client, now):
        """Record a strike; return True if it starts a block."""
        penalty = self._penalty
        strikes = client.strikes
        strikes.append(now)
        while strikes and strikes[0] <= now - penalty.window_ms:
            strikes.popleft()
        if len(strikes) < penalty.strikes:
            return False
        strikes.clear()
        client.blocked_until = now + penalty.block_seconds * 1000
        return True

    def change_plan(self, client_id, plan, now):
        client = self._client(client_id)
        if plan not in self._plans:
            raise UnknownPlanError(f"unknown plan {plan!r}")
        old_rules = self._plans[client.plan].rules
        new_rules = self._plans[plan].rules
        for text, bucket in list(client.buckets.items()):
            new_rule = new_rules.get(text)
            if new_rule is None:
                del client.buckets[text]
                continue
            old_rule = old_rules[text]
            bucket.refill(old_rule, now)
            spent = old_rule.capacity - bucket.units
            bucket.units = max(0, new_rule.capacity - spent)
        client.plan = plan

    def usage(self, client_id, now):
        client = self._client(client_id)
        plan = self._plans[client.plan]
        used = client.used_on(now // DAY_MS)
        rules = []
        for text in sorted(plan.rules):
            rule = plan.rules[text]
            bucket = client.buckets.get(text)
            units = rule.capacity if bucket is None else bucket.level(rule, now)
            allowed, denied = client.counts.get(text, (0, 0))
            rules.append({"rule": text, "tokens": units // UNITS, "allowed": allowed, "denied": denied})
        return {
            "client_id": client_id,
            "plan": client.plan,
            "day_used": used,
            "day_remaining": None if plan.daily_quota is None else max(0, plan.daily_quota - used),
            "blocked_until": client.blocked_until if client.blocked_at(now) else None,
            "rules": rules,
        }
