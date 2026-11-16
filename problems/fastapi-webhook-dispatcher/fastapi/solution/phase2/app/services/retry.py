"""When to try a failed delivery again, and when to stop."""

# Worth retrying: the subscriber timed out, is rate limiting us, or had a server error.
RETRYABLE_STATUS = frozenset({408, 429})


class RetryPolicy:
    def __init__(self, base_seconds: float, max_delay_seconds: float, max_attempts: int) -> None:
        self.base_seconds = base_seconds
        self.max_delay_seconds = max_delay_seconds
        self.max_attempts = max_attempts

    def is_retryable(self, status_code: int | None) -> bool:
        """Whether a failed attempt is worth repeating. ``None`` means no HTTP response at all."""
        return status_code is None or status_code in RETRYABLE_STATUS or status_code >= 500

    def delay_after(self, attempt: int, retry_after: float | None = None) -> float:
        """Seconds to wait after failed attempt number ``attempt`` (1-based).

        base * 2^(attempt - 1), capped at max_delay. A longer Retry-After from
        the subscriber wins, still within the cap.
        """
        delay = min(self.base_seconds * 2 ** (attempt - 1), self.max_delay_seconds)
        if retry_after is not None:
            delay = max(delay, min(retry_after, self.max_delay_seconds))
        return delay

    @staticmethod
    def parse_retry_after(value: str | None) -> float | None:
        """Retry-After in seconds; HTTP dates and junk are ignored."""
        if value is None or not value.strip().isdigit():
            return None
        return float(value.strip())
