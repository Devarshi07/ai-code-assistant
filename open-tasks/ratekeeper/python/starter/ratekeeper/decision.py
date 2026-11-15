"""The answer RateKeeper gives the gateway for one request."""
from dataclasses import dataclass

OK = "ok"
RATE_LIMITED = "rate_limited"      # Part 1: the rule's bucket has no whole token
QUOTA_EXCEEDED = "quota_exceeded"  # Part 2: the client used up today's quota
BLOCKED = "blocked"                # Part 3: the client is in the penalty box


@dataclass(frozen=True)
class Decision:
    """Whether a request may go through, plus the numbers for response headers.

    allowed      True if the gateway should forward the request.
    remaining    Whole tokens left in the matched rule's bucket after this
                 decision, rounded down.
    retry_after  0 when allowed. Otherwise whole seconds the client should
                 wait, rounded up: until the next whole token (rate_limited),
                 the next day (quota_exceeded) or the end of the block (blocked).
    reason       One of OK, RATE_LIMITED, QUOTA_EXCEEDED, BLOCKED.
    rule         The pattern of the rule that matched the route.
    """

    allowed: bool
    remaining: int
    retry_after: int
    reason: str
    rule: str
